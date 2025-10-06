import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const mocks = vi.hoisted(() => {
  const generateAppealLetterMock = vi.fn();
  const renderAppealLetterPdfMock = vi.fn();
  const resolveCountyMetadataMock = vi.fn();
  const ensureUserDocumentsBucketMock = vi.fn();
  const getSupabaseServiceRoleClientMock = vi.fn();
  const getStorageConfigMock = vi.fn();
  const documentGroupFindUniqueMock = vi.fn();
  const documentGroupFindFirstMock = vi.fn();
  const documentGroupCreateMock = vi.fn();
  const documentFindFirstMock = vi.fn();
  const documentUpdateManyMock = vi.fn();
  const documentCreateMock = vi.fn();
  const transactionMock = vi.fn();
  const supabaseUploadMock = vi.fn();
  const supabaseSignedUrlMock = vi.fn();

  getStorageConfigMock.mockReturnValue({
    bucketName: "user-documents",
    allowedMimeTypes: ["application/pdf"],
    maxFileSizeBytes: 25 * 1024 * 1024,
  });

  return {
    generateAppealLetterMock,
    renderAppealLetterPdfMock,
    resolveCountyMetadataMock,
    ensureUserDocumentsBucketMock,
    getSupabaseServiceRoleClientMock,
    getStorageConfigMock,
    documentGroupFindUniqueMock,
    documentGroupFindFirstMock,
    documentGroupCreateMock,
    documentFindFirstMock,
    documentUpdateManyMock,
    documentCreateMock,
    transactionMock,
    supabaseUploadMock,
    supabaseSignedUrlMock,
  };
});

vi.mock("@/lib/letters/generator", () => ({
  generateAppealLetter: mocks.generateAppealLetterMock,
}));

vi.mock("@/lib/letters/pdf", () => ({
  renderAppealLetterPdf: mocks.renderAppealLetterPdfMock,
}));

vi.mock("@/lib/letters/metadata", () => ({
  resolveCountyMetadata: mocks.resolveCountyMetadataMock,
}));

vi.mock("@/lib/supabase", () => ({
  ensureUserDocumentsBucket: mocks.ensureUserDocumentsBucketMock,
  getSupabaseServiceRoleClient: mocks.getSupabaseServiceRoleClientMock,
  getStorageConfig: mocks.getStorageConfigMock,
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    documentGroup: {
      findUnique: (...args: unknown[]) => mocks.documentGroupFindUniqueMock(...args),
      findFirst: (...args: unknown[]) => mocks.documentGroupFindFirstMock(...args),
      create: (...args: unknown[]) => mocks.documentGroupCreateMock(...args),
    },
    document: {
      findFirst: (...args: unknown[]) => mocks.documentFindFirstMock(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transactionMock(...args),
  },
}));

describe("POST /api/letters", () => {
  const envOpenAi = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai";
    mocks.generateAppealLetterMock.mockReset();
    mocks.renderAppealLetterPdfMock.mockReset();
    mocks.resolveCountyMetadataMock.mockReset();
    mocks.ensureUserDocumentsBucketMock.mockReset();
    mocks.getSupabaseServiceRoleClientMock.mockReset();
    mocks.getStorageConfigMock.mockReset();
    mocks.documentGroupFindUniqueMock.mockReset();
    mocks.documentGroupFindFirstMock.mockReset();
    mocks.documentGroupCreateMock.mockReset();
    mocks.documentFindFirstMock.mockReset();
    mocks.documentUpdateManyMock.mockReset();
    mocks.documentCreateMock.mockReset();
    mocks.transactionMock.mockReset();
    mocks.supabaseUploadMock.mockReset();
    mocks.supabaseSignedUrlMock.mockReset();

    mocks.getStorageConfigMock.mockReturnValue({
      bucketName: "user-documents",
      allowedMimeTypes: ["application/pdf"],
      maxFileSizeBytes: 25 * 1024 * 1024,
    });

    mocks.resolveCountyMetadataMock.mockResolvedValue({
      jurisdiction: "Franklin County, Ohio",
      taxYear: 2024,
      primaryAuthority: "Franklin County Board of Revision",
      submissionChannels: [],
      forms: [],
    });

    mocks.generateAppealLetterMock.mockResolvedValue({
      sections: {
        header: "Header",
        salutation: "Dear Board",
        body: ["Paragraph"],
        closing: "Respectfully",
        signature: "Owner",
        filingReminders: ["Reminder"],
        disclaimer: "Not legal advice",
      },
      usage: { model: "gpt", inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    mocks.renderAppealLetterPdfMock.mockResolvedValue(Buffer.from("pdf"));

    mocks.getSupabaseServiceRoleClientMock.mockReturnValue({
      storage: {
        from: () => ({
          upload: mocks.supabaseUploadMock.mockResolvedValue({ error: null }),
          createSignedUrl: mocks.supabaseSignedUrlMock.mockResolvedValue({
            data: { signedUrl: "https://signed" },
            error: null,
          }),
        }),
      },
    });

    mocks.documentGroupFindUniqueMock.mockResolvedValue({
      id: "group-1",
      userId: "user-1",
      type: "UPLOAD",
      extraction: {
        payload: {
          parcelId: "pid",
          ownerName: "Jane Doe",
          propertyAddress: "100 Main St",
          assessedValue: 450000,
          marketValue: 400000,
          taxYear: "2025",
          assessmentDate: "2025-07-01",
          appealDeadline: "2025-08-15",
          notes: "",
        },
      },
      valuations: [
        {
          provider: "zillow",
          providerId: "zpid",
          amount: 400000,
          currency: "USD",
          valuationDate: new Date("2025-01-01T00:00:00Z"),
          confidence: "MEDIUM",
          rawResponse: { analytics: { countyFips: "39049", taxHistory: [] } },
        },
      ],
    });

    mocks.documentGroupFindFirstMock.mockResolvedValue(null);
    mocks.documentGroupCreateMock.mockResolvedValue({ id: "letters-1", userId: "user-1" });
    mocks.documentFindFirstMock.mockResolvedValue(null);

    mocks.documentUpdateManyMock.mockResolvedValue({});
    mocks.documentCreateMock.mockResolvedValue({ id: "doc-1", versionNumber: 1 });
    mocks.transactionMock.mockImplementation(async (
      callback: (tx: {
        document: {
          updateMany: typeof mocks.documentUpdateManyMock;
          create: typeof mocks.documentCreateMock;
        };
      }) => Promise<unknown>,
    ) => {
      return callback({
        document: {
          updateMany: mocks.documentUpdateManyMock,
          create: mocks.documentCreateMock,
        },
      });
    });
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = envOpenAi;
  });

  it("generates a letter and returns metadata", async () => {
    const request = new Request("http://localhost/api/letters", {
      method: "POST",
      body: JSON.stringify({ documentGroupId: "11111111-1111-4111-8111-111111111111" }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.documentId).toBe("doc-1");
    expect(json.version).toBe(1);
    expect(json.signedUrl).toBe("https://signed");

    expect(mocks.generateAppealLetterMock).toHaveBeenCalledTimes(1);
    expect(mocks.renderAppealLetterPdfMock).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseUploadMock).toHaveBeenCalledTimes(1);
    expect(mocks.documentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: "Appeal Letter v1",
          source: "GENERATED",
          mimeType: "application/pdf",
        }),
      }),
    );
  });

  it("returns 409 when assessment extraction is missing", async () => {
    mocks.documentGroupFindUniqueMock.mockResolvedValueOnce({
      id: "group-1",
      userId: "user-1",
      type: "UPLOAD",
      extraction: null,
      valuations: [],
    });

    const request = new Request("http://localhost/api/letters", {
      method: "POST",
      body: JSON.stringify({ documentGroupId: "11111111-1111-4111-8111-111111111111" }),
    });

    const response = await POST(request as unknown as NextRequest);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("Assessment data is missing");
  });
});
