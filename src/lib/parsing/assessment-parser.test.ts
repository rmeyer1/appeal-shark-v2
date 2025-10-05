import { describe, expect, it } from "vitest";
import { parseAssessmentDocument } from "./assessment-parser";

const pdfcoResponse = {
  body: "Parcel ID: 123-45-678\nOwner: Jane Smith\nAddress: 100 Main St\nAssessed Value: $450,000\nMarket Value: $420,000\nTax Year: 2025\nNotice Date: July 1, 2025\nAppeal Deadline: August 15, 2025",
  pageCount: 2,
  credits: 1,
};

const openaiResponse = {
  output_text: [
    JSON.stringify({
      parcelId: "123-45-678",
      ownerName: "Jane Smith",
      propertyAddress: "100 Main St",
      assessedValue: 450000,
      marketValue: 420000,
      taxYear: "2025",
      assessmentDate: "2025-07-01",
      appealDeadline: "2025-08-15",
      notes: "Deadline falls within 45 days of notice date.",
    }),
  ],
  usage: {
    input_tokens: 1100,
    output_tokens: 130,
    total_tokens: 1230,
  },
  model: "gpt-4o-mini-2024-07-18",
};

describe("parseAssessmentDocument", () => {
  it("returns structured assessment data", async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit | undefined }> = [];

    const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const resolvedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;

      fetchCalls.push({ url: resolvedUrl, init });

      if (resolvedUrl.includes("pdf.co")) {
        return new Response(JSON.stringify(pdfcoResponse), { status: 200 });
      }

      if (resolvedUrl.includes("openai.com")) {
        return new Response(JSON.stringify(openaiResponse), { status: 200 });
      }

      throw new Error(`Unexpected fetch call: ${resolvedUrl}`);
    };

    const result = await parseAssessmentDocument({
      signedUrl: "https://signed-url.example.com/file.pdf",
      pdfcoApiKey: "test-pdfco",
      openaiApiKey: "test-openai",
      clients: {
        pdfcoFetch: fakeFetch,
        openaiFetch: fakeFetch,
      },
    });

    expect(result.extracted.parcelId).toBe("123-45-678");
    expect(result.metadata.pdfco.pageCount).toBe(2);
    expect(result.metadata.openai.totalTokens).toBe(1230);
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].url).toContain("pdf.co");
    expect(fetchCalls[1].url).toContain("openai.com");
  });

  it("throws when OpenAI response is missing structured content", async () => {
    const pdfcoFetch = async (input: RequestInfo | URL) => {
      const resolvedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (!resolvedUrl.includes("pdf.co")) {
        throw new Error(`Unexpected fetch call: ${resolvedUrl}`);
      }
      return new Response(JSON.stringify(pdfcoResponse), { status: 200 });
    };
    const openaiFetch = async (input: RequestInfo | URL) => {
      const resolvedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (!resolvedUrl.includes("openai.com")) {
        throw new Error(`Unexpected fetch call: ${resolvedUrl}`);
      }
      return new Response(JSON.stringify({ output_text: [] }), { status: 200 });
    };

    await expect(
      parseAssessmentDocument({
        signedUrl: "https://signed-url.example.com/file.pdf",
        pdfcoApiKey: "test-pdfco",
        openaiApiKey: "test-openai",
        clients: { pdfcoFetch, openaiFetch },
      }),
    ).rejects.toThrow(/did not include structured content/);
  });
});
