import { describe, expect, it, vi } from "vitest";
import { convertPdfToText } from "./pdfco";

describe("convertPdfToText", () => {
  it("uses the fallback url when PDF.co omits inline body", async () => {
    const apiUrl = "https://api.pdf.co/v1/pdf/convert/to/text";
    const resultUrl = "https://pdfco.example.com/result.txt";
    const responses = [
      new Response(JSON.stringify({ url: resultUrl, pageCount: 2, credits: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response("mocked text content", { status: 200 }),
    ];

    const fetchMock = vi.fn(() => {
      const next = responses.shift();

      if (!next) {
        return Promise.reject(new Error("Unexpected fetch call"));
      }

      return Promise.resolve(next);
    });

    const result = await convertPdfToText({
      signedUrl: "https://example.com/signed.pdf",
      apiKey: "fake-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
      endpoint: apiUrl,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, apiUrl, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, resultUrl);
    expect(result.text).toBe("mocked text content");
    expect(result.meta).toEqual({ pageCount: 2, credits: 1 });
  });
});
