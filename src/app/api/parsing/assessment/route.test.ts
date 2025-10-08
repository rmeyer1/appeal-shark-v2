import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";
import { parseAssessmentDocument } from "@/lib/parsing/assessment-parser";
import { lookupZillowValuation } from "@/lib/zillow";

const createSignedUrlMock = vi.fn();

const { upsertMock, valuationUpsertMock, prismaMock } = vi.hoisted(() => {
  const upsert = vi.fn();
  const valuationUpsert = vi.fn();
  return {
    upsertMock: upsert,
    valuationUpsertMock: valuationUpsert,
    prismaMock: {
      assessmentExtraction: {
        upsert,
      },
      propertyValuation: {
        upsert: valuationUpsert,
      },
    },
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseServiceRoleClient: vi.fn(() => ({
    storage: {
      from: () => ({
        createSignedUrl: createSignedUrlMock,
      }),
    },
  })),
}));

vi.mock("@/lib/parsing/assessment-parser", () => ({
  parseAssessmentDocument: vi.fn(),
}));

vi.mock("@/lib/zillow", () => ({
  lookupZillowValuation: vi.fn(),
  ZillowMissingCredentialsError: class extends Error {},
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
}));

const parseAssessmentMock = vi.mocked(parseAssessmentDocument);
const lookupZillowMock = vi.mocked(lookupZillowValuation);

describe("POST /api/parsing/assessment", () => {
  const envPdfco = process.env.PDFCO_API_KEY;
  const envOpenai = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createSignedUrlMock.mockReset();
    parseAssessmentMock.mockReset();
    lookupZillowMock.mockReset();
    upsertMock.mockReset();
    valuationUpsertMock.mockReset();
    process.env.PDFCO_API_KEY = "test-pdfco";
    process.env.OPENAI_API_KEY = "test-openai";
  });

  afterAll(() => {
    process.env.PDFCO_API_KEY = envPdfco;
    process.env.OPENAI_API_KEY = envOpenai;
  });

  it("returns parsed payload when successful", async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null });
    parseAssessmentMock.mockResolvedValue({
      rawText: "mock text",
      extracted: {
        parcelId: "abc",
        ownerName: "Jane Smith",
        propertyAddress: "100 Main St, Columbus, OH 43215",
        assessedValue: 450000,
        marketValue: 420000,
        taxYear: "2025",
        assessmentDate: "2025-07-01",
        appealDeadline: "2025-08-15",
        notes: "Deadline within 45 days.",
      },
      metadata: {
        pdfco: { pageCount: 1, credits: 0 },
        openai: { model: "test", inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
    });
    upsertMock.mockResolvedValue({ id: "extraction-id" });
    lookupZillowMock.mockResolvedValue({
      provider: "zillow",
      zpid: "999999",
      amount: 500123,
      currency: "USD",
      confidence: "HIGH",
      valuationDate: new Date("2025-01-15T00:00:00Z"),
      searchHit: { zpid: "999999" },
      propertyDetail: { zpid: "999999" },
      analytics: {
        countyFips: "39049",
        assessmentRatioUsed: null,
        valuationRange: { highEstimate: null, highPercent: null },
        taxHistory: [],
        latest: null,
        averageMillageRate: null,
        averageEffectiveTaxRate: null,
        projectedTaxAtMarket: null,
        projectedSavingsVsLatest: null,
        propertyFacts: {
          livingArea: null,
          bedrooms: null,
          bathrooms: null,
          pricePerSquareFoot: null,
        },
        latestSale: null,
      },
    });
    valuationUpsertMock.mockResolvedValue({});

    const request = new Request("http://localhost/api/parsing/assessment", {
      method: "POST",
      body: JSON.stringify({
        path: "user-id/group/file.pdf",
        documentGroupId: "11111111-1111-4111-8111-111111111111",
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.extracted.parcelId).toBe("abc");
    expect(json.valuation).toEqual({
      provider: "zillow",
      amount: 500123,
      currency: "USD",
      zpid: "999999",
      confidence: "HIGH",
      valuationDate: "2025-01-15T00:00:00.000Z",
        analytics: {
          countyFips: "39049",
          assessmentRatioUsed: null,
          valuationRange: { highEstimate: null, highPercent: null },
          taxHistory: [],
          latest: null,
          averageMillageRate: null,
          averageEffectiveTaxRate: null,
          projectedTaxAtMarket: null,
          projectedSavingsVsLatest: null,
          propertyFacts: {
            livingArea: null,
            bedrooms: null,
            bathrooms: null,
            pricePerSquareFoot: null,
          },
          latestSale: null,
        },
    });
    expect(parseAssessmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signedUrl: "https://signed",
      }),
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentGroupId: "11111111-1111-4111-8111-111111111111" },
      }),
    );
    expect(valuationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          documentGroupId_provider: {
            documentGroupId: "11111111-1111-4111-8111-111111111111",
            provider: "zillow",
          },
        },
      }),
    );
  });

  it("validates request payload", async () => {
    const request = new Request("http://localhost/api/parsing/assessment", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("storage path");
  });

  it("continues when Zillow valuation is unavailable", async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null });
    parseAssessmentMock.mockResolvedValue({
      rawText: "mock text",
      extracted: {
        parcelId: "abc",
        ownerName: "Jane Smith",
        propertyAddress: "101 Unknown Ave, Anywhere, USA",
        assessedValue: 450000,
        marketValue: 420000,
        taxYear: "2025",
        assessmentDate: "2025-07-01",
        appealDeadline: "2025-08-15",
        notes: "Deadline within 45 days.",
      },
      metadata: {
        pdfco: { pageCount: 1, credits: 0 },
        openai: { model: "test", inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      },
    });
    upsertMock.mockResolvedValue({ id: "extraction-id" });
    lookupZillowMock.mockResolvedValue(null);

    const request = new Request("http://localhost/api/parsing/assessment", {
      method: "POST",
      body: JSON.stringify({
        path: "user-id/group/file.pdf",
        documentGroupId: "11111111-1111-4111-8111-111111111112",
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.valuation).toBeNull();
    expect(valuationUpsertMock).not.toHaveBeenCalled();
  });

  it("validates documentGroupId", async () => {
    const request = new Request("http://localhost/api/parsing/assessment", {
      method: "POST",
      body: JSON.stringify({ path: "user-id/group/file.pdf" }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("documentGroupId");
  });
});
