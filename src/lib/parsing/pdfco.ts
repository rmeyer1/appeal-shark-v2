import type { ConvertToTextArgs, JobStatusResponse, PdfCoTextExtractionResponse } from "@/types/pdfco";

const DEFAULT_ENDPOINT = "https://api.pdf.co/v1/pdf/convert/to/text";
const DEFAULT_JOB_STATUS_ENDPOINT = "https://api.pdf.co/v1/job/check";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLLS = 60;


function normalizeError(messageCandidates: Array<string | boolean | undefined>, fallback: string) {
  for (const candidate of messageCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return fallback;
}

async function pollPdfCoJob({
  jobId,
  apiKey,
  fetchImpl,
  statusEndpoint,
  pollIntervalMs,
  maxPolls,
}: {
  jobId: string;
  apiKey: string;
  fetchImpl: typeof fetch;
  statusEndpoint: string;
  pollIntervalMs: number;
  maxPolls: number;
}): Promise<JobStatusResponse> {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const statusResponse = await fetchImpl(statusEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        jobId,
        jobid: jobId,
      }),
    });

    const payload = (await statusResponse.json()) as JobStatusResponse;

    if (!statusResponse.ok || payload.error) {
      const message = normalizeError(
        [payload.error, payload.message],
        `PDF.co job check failed with status ${statusResponse.status}`,
      );
      throw new Error(message);
    }

    const status = typeof payload.status === "string" ? payload.status.toLowerCase() : undefined;

    if (status === "success") {
      return payload;
    }

    if (status && ["failed", "error", "aborted"].includes(status)) {
      throw new Error(payload.message || "PDF.co job reported an error.");
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("PDF.co job polling timed out.");
}

async function extractTextFromPayload(
  payload: PdfCoTextExtractionResponse,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  if (typeof payload.body === "string" && payload.body.trim().length > 0) {
    return payload.body;
  }

  if (payload.url) {
    const downloadResponse = await fetchImpl(payload.url);

    if (!downloadResponse.ok) {
      throw new Error(`PDF.co result download failed with status ${downloadResponse.status}`);
    }

    return downloadResponse.text();
  }

  return null;
}

export async function convertPdfToText({
  signedUrl,
  apiKey,
  fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  jobStatusEndpoint = DEFAULT_JOB_STATUS_ENDPOINT,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPolls = DEFAULT_MAX_POLLS,
}: ConvertToTextArgs): Promise<{
  text: string;
  meta: { pageCount: number | null; credits: number | null };
}> {
  if (!signedUrl) {
    throw new Error("signedUrl is required for PDF.co conversion.");
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      url: signedUrl,
      async: true,
      encrypt: false,
      inline: true,
    }),
  });

  const payload = (await response.json()) as PdfCoTextExtractionResponse;

  const handlePayload = async (resultPayload: PdfCoTextExtractionResponse) => {
    const extractedText = await extractTextFromPayload(resultPayload, fetchImpl);

    if (!extractedText) {
      throw new Error("PDF.co response did not include extracted text.");
    }

    return {
      text: extractedText,
      meta: {
        pageCount: typeof resultPayload.pageCount === "number" ? resultPayload.pageCount : null,
        credits: typeof resultPayload.credits === "number" ? resultPayload.credits : null,
      },
    };
  };

  const jobId = payload.jobId || payload.jobid;

  if (jobId) {
    const jobResult = await pollPdfCoJob({
      jobId,
      apiKey,
      fetchImpl,
      statusEndpoint: jobStatusEndpoint,
      pollIntervalMs,
      maxPolls,
    });

    return handlePayload({
      body: jobResult.body,
      url: jobResult.url,
      pageCount: payload.pageCount,
      credits: payload.credits,
    });
  }

  if (!response.ok) {
    const message = normalizeError(
      [payload.error, payload.message],
      `PDF.co request failed with status ${response.status}`,
    );
    throw new Error(message);
  }

  if (payload.error) {
    const message = normalizeError(
      [payload.error, payload.message],
      "PDF.co reported an error while starting the job.",
    );
    throw new Error(message);
  }

  return handlePayload(payload);
}

export type { ConvertToTextArgs, PdfCoTextExtractionResponse } from "@/types/pdfco";
