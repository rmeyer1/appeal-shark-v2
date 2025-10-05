import { convertPdfToText } from "@/lib/parsing/pdfco";
import { extractAssessmentFields } from "@/lib/parsing/openai";
import type { AssessmentExtractionResult } from "@/types/openai";

export type AssessmentParseOptions = {
  signedUrl: string;
  pdfcoApiKey: string;
  openaiApiKey: string;
  openaiModel?: string;
  clients?: {
    pdfcoFetch?: typeof fetch;
    openaiFetch?: typeof fetch;
  };
};

export type AssessmentParseResult = {
  rawText: string;
  extracted: AssessmentExtractionResult["structured"];
  metadata: {
    pdfco: {
      pageCount: number | null;
      credits: number | null;
    };
    openai: AssessmentExtractionResult["usage"];
  };
};

export async function parseAssessmentDocument({
  signedUrl,
  pdfcoApiKey,
  openaiApiKey,
  openaiModel,
  clients,
}: AssessmentParseOptions): Promise<AssessmentParseResult> {
  if (!pdfcoApiKey) {
    throw new Error("PDF.co API key is missing.");
  }

  if (!openaiApiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const { text, meta } = await convertPdfToText({
    signedUrl,
    apiKey: pdfcoApiKey,
    fetchImpl: clients?.pdfcoFetch,
  });

  const extraction = await extractAssessmentFields({
    text,
    apiKey: openaiApiKey,
    model: openaiModel,
    fetchImpl: clients?.openaiFetch,
  });

  return {
    rawText: text,
    extracted: extraction.structured,
    metadata: {
      pdfco: meta,
      openai: extraction.usage,
    },
  };
}
