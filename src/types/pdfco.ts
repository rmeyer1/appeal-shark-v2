export type PdfCoTextExtractionResponse = {
  body?: string;
  pageCount?: number;
  credits?: number;
  error?: string;
  status?: number;
  remainingCredits?: number;
  url?: string;
};

export type ConvertToTextArgs = {
  signedUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
};
