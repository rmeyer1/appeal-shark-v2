import { describe, expect, it, vi } from "vitest";

import { convertPdfToText } from "./pdfco";

describe("convertPdfToText", () => {
  it("polls until PDF.co returns a result url and downloads the content", async () => {
    const jobId = "job-123";
    const resultUrl = "https://pdfco.example.com/result.txt";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId, pageCount: 2, credits: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "working" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "success", url: resultUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("mocked text content", { status: 200 }));

    const result = await convertPdfToText({
      signedUrl: "https://example.com/signed.pdf",
      apiKey: "fake-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
      pollIntervalMs: 0,
      maxPolls: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.pdf.co/v1/pdf/convert/to/text",
      expect.objectContaining({ method: "POST" }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.pdf.co/v1/job/check",
      expect.objectContaining({ method: "POST" }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(4, resultUrl);
    expect(result.text).toBe("mocked text content");
    expect(result.meta).toEqual({ pageCount: 2, credits: 1 });

    const pollBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(pollBody.jobId).toBe(jobId);
  });

  it("returns inline text when the job responds with an inline body", async () => {
    const jobId = "job-inline";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId, pageCount: 1, credits: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "success", body: "inline text" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await convertPdfToText({
      signedUrl: "https://example.com/file.pdf",
      apiKey: "fake-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
      pollIntervalMs: 0,
      maxPolls: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("inline text");
    expect(result.meta).toEqual({ pageCount: 1, credits: 1 });
  });

  it("surfaces PDF.co error messages", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true, message: "Invalid API Key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      convertPdfToText({
        signedUrl: "https://example.com/file.pdf",
        apiKey: "bad-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow("Invalid API Key");
  });

  it("throws when a polled job reports a terminal failure", async () => {
    const jobId = "job-failed";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "failed", message: "Processing error" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      convertPdfToText({
        signedUrl: "https://example.com/file.pdf",
        apiKey: "fake-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
        pollIntervalMs: 0,
        maxPolls: 1,
      }),
    ).rejects.toThrow("Processing error");
  });
});
