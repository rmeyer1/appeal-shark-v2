import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { LetterSectionPayload } from "@/types/letters";

const PAGE_WIDTH = 612; // 8.5" letter size in points
const PAGE_HEIGHT = 792; // 11"
const PAGE_MARGIN = 56;
const LINE_HEIGHT = 16;
const BULLET = "\u2022";

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

export async function renderAppealLetterPdf(sections: LetterSectionPayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let cursorY = PAGE_HEIGHT - PAGE_MARGIN;
  const usableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;

  const drawLines = (
    lines: string[],
    options?: { font?: PDFFont; size?: number; color?: { r: number; g: number; b: number } },
  ) => {
    const font = options?.font ?? timesRomanFont;
    const fontSize = options?.size ?? 12;
    const color = options?.color ?? { r: 0, g: 0, b: 0 };
    for (const line of lines) {
      if (cursorY <= PAGE_MARGIN + LINE_HEIGHT) {
        cursorY = PAGE_HEIGHT - PAGE_MARGIN;
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      }
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      cursorY -= LINE_HEIGHT;
    }
    cursorY -= LINE_HEIGHT / 2;
  };

  const drawParagraph = (text: string, options?: { font?: PDFFont; size?: number }) => {
    const font = options?.font ?? timesRomanFont;
    const fontSize = options?.size ?? 12;
    const wrapped = wrapText(text, font, fontSize, usableWidth);
    drawLines(wrapped, { font, size: fontSize });
  };

  drawParagraph(sections.header, { font: timesBoldFont, size: 12 });
  drawParagraph(sections.salutation, { font: timesRomanFont, size: 12 });

  for (const paragraph of sections.body) {
    drawParagraph(paragraph, { font: timesRomanFont, size: 12 });
  }

  drawParagraph(sections.closing, { font: timesRomanFont, size: 12 });
  drawParagraph(sections.signature, { font: timesBoldFont, size: 12 });

  if (sections.filingReminders.length) {
    drawParagraph("Key filing steps:", { font: timesBoldFont, size: 12 });
    for (const reminder of sections.filingReminders) {
      const wrapped = wrapText(`${BULLET} ${reminder}`, timesRomanFont, 11, usableWidth);
      drawLines(wrapped, { font: timesRomanFont, size: 11 });
    }
  }

  if (sections.attachments.length) {
    drawParagraph("Suggested attachments:", { font: timesBoldFont, size: 12 });
    for (const attachment of sections.attachments) {
      const wrapped = wrapText(`${BULLET} ${attachment}`, timesRomanFont, 11, usableWidth);
      drawLines(wrapped, { font: timesRomanFont, size: 11 });
    }
  }

  drawParagraph(sections.disclaimer, { font: timesRomanFont, size: 10 });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
