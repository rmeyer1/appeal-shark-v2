export type AssessmentExtraction = {
  parcelId: string | null;
  ownerName: string | null;
  propertyAddress: string | null;
  assessedValue: number | null;
  marketValue: number | null;
  taxYear: string | null;
  assessmentDate: string | null;
  appealDeadline: string | null;
  notes: string | null;
};

export type ExtractAssessmentArgs = {
  text: string;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export type OpenAIResponse = {
  output_text?: string[];
  output?: Array<{
    content?: Array<
      | { type?: string; text?: string }
      | { type?: string; refusal?: { reason?: string; message?: string } }
    >;
    role?: string;
    type?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
};

export type OpenAIErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string;
  };
};

export type AssessmentExtractionResult = {
  structured: AssessmentExtraction;
  usage: {
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};
