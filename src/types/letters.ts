import type { AssessmentExtraction } from "@/types/openai";
import type { ZillowValuationAnalytics } from "@/types/zillow";

export type CountyFilingChannel = {
  type: string;
  label?: string;
  url?: string;
  value?: string;
  address?: string;
  note?: string;
  postmarkRequirement?: string;
};

export type CountyForm = {
  name: string;
  url: string;
};

export type CountyMetadata = {
  jurisdiction: string;
  taxYear: number | string | null;
  primaryAuthority: string | null;
  notes?: string | null;
  filingWindow?: {
    start?: string | null;
    end?: string | null;
    notes?: string | null;
    timezone?: string | null;
  };
  alternateWindows?: Record<string, { notes?: string | null; calendarUrl?: string | null }>;
  submissionChannels: CountyFilingChannel[];
  forms: CountyForm[];
};

export type LetterContext = {
  assessment: AssessmentExtraction;
  analytics: ZillowValuationAnalytics | null;
  valuationSource: string | null;
  savingsEstimate: number | null;
  countyMetadata: CountyMetadata | null;
};

export type LetterSectionPayload = {
  header: string;
  salutation: string;
  body: string[];
  closing: string;
  signature: string;
  filingReminders: string[];
  attachments: string[];
  disclaimer: string;
};

export type LetterGenerationUsage = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type LetterGenerationResult = {
  sections: LetterSectionPayload;
  usage: LetterGenerationUsage;
};
