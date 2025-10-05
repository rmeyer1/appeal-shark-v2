import type { ConvertToTextArgs, PdfCoTextExtractionResponse } from "@/types/pdfco";

const DEFAULT_ENDPOINT = "https://api.pdf.co/v1/pdf/convert/to/text";

export async function convertPdfToText({
  signedUrl,
  apiKey,
  fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
}: ConvertToTextArgs): Promise<{
  text: string;
  meta: { pageCount: number | null; credits: number | null };
}> {
  if (!signedUrl) {
    throw new Error("signedUrl is required for PDF.co conversion.");
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      url: signedUrl,
      async: false,
      encrypt: false,
    }),
  });

  const payload = (await response.json()) as PdfCoTextExtractionResponse;

  if (!response.ok || payload.error) {
    const message = payload.error || `PDF.co request failed with status ${response.status}`;
    throw new Error(message);
  }

  let extractedText: string | null = null;

  if (typeof payload.body === "string" && payload.body.trim().length > 0) {
    extractedText = payload.body;
  } else if (payload.url) {
    const downloadResponse = await fetchImpl(payload.url);

    if (!downloadResponse.ok) {
      throw new Error(`PDF.co result download failed with status ${downloadResponse.status}`);
    }

    extractedText = await downloadResponse.text();
  }

  if (!extractedText) {
    throw new Error("PDF.co response did not include extracted text.");
  }

  return {
    text: extractedText,
    meta: {
      pageCount: typeof payload.pageCount === "number" ? payload.pageCount : null,
      credits: typeof payload.credits === "number" ? payload.credits : null,
    },
  };
}

export type { ConvertToTextArgs, PdfCoTextExtractionResponse } from "@/types/pdfco";
