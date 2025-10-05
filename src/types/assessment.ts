import type { ZillowValuationAnalytics } from "@/types/zillow";

type Nullable<T> = T | null;

export type UploadState = "idle" | "uploading" | "success" | "error";

export type ParsingState = "idle" | "loading" | "success" | "error";

export type UploadResponse = {
  bucket: string;
  path: string;
  message: string;
  documentGroupId: string;
  documentId: string;
  userId: string;
};

export type ApiValuation = {
  provider: string;
  amount: Nullable<number>;
  currency: Nullable<string>;
  zpid: Nullable<string>;
  confidence: Nullable<string>;
  valuationDate: Nullable<string>;
  analytics: Nullable<ZillowValuationAnalytics>;
};

export type DerivedValuation = {
  assessedValue: Nullable<number>;
  marketValue: Nullable<number>;
  marketSource: Nullable<string>;
  savings: Nullable<number>;
  zillow: Nullable<ApiValuation>;
  analytics: Nullable<ZillowValuationAnalytics>;
};

export type ParsingResponse = {
  extracted: {
    parcelId: Nullable<string>;
    ownerName: Nullable<string>;
    propertyAddress: Nullable<string>;
    assessedValue: Nullable<number>;
    marketValue: Nullable<number>;
    taxYear: Nullable<string>;
    assessmentDate: Nullable<string>;
    appealDeadline: Nullable<string>;
    notes: Nullable<string>;
  };
  metadata: {
    pdfco: { pageCount: Nullable<number>; credits: Nullable<number> };
    openai: {
      model: string;
      inputTokens: Nullable<number>;
      outputTokens: Nullable<number>;
      totalTokens: Nullable<number>;
    };
  };
  rawText: string;
  assessmentExtractionId: string;
  valuation?: Nullable<ApiValuation>;
};

export type ParseRequestBody = {
  path?: string;
  bucket?: string;
  expiresInSeconds?: number;
  openaiModel?: string;
  documentGroupId?: string;
};
