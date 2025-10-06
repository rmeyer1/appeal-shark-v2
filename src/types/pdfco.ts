export type PdfCoTextExtractionResponse = {
  body?: string;
  pageCount?: number;
  credits?: number;
  error?: string | boolean;
  message?: string;
  status?: string | number;
  remainingCredits?: number;
  url?: string;
  jobId?: string;
  jobid?: string;
};

export type ConvertToTextArgs = {
  signedUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  jobStatusEndpoint?: string;
  pollIntervalMs?: number;
  maxPolls?: number;
};

export type JobStatusResponse = {
  error?: boolean | string;
  message?: string;
  status?: string;
  url?: string;
  body?: string;
};