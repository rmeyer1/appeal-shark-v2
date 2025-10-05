import type { QueryParams, ZillowRequestOptions } from "@/types/zillow";

const DEFAULT_BASE_URL = "https://zillow-com1.p.rapidapi.com";
const DEFAULT_HOST = "zillow-com1.p.rapidapi.com";

export class ZillowApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ZillowApiError";
    this.status = status;
    this.body = body;
  }
}

export class ZillowMissingCredentialsError extends Error {
  constructor(message = "ZILLOW_API_KEY environment variable is not configured.") {
    super(message);
    this.name = "ZillowMissingCredentialsError";
  }
}

function buildUrl(path: string, params: QueryParams, baseUrl: string): string {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }
    const value = typeof rawValue === "boolean" ? String(rawValue) : String(rawValue);
    if (value.length > 0) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export async function zillowRequest<T>(
  path: string,
  params: QueryParams,
  options: ZillowRequestOptions = {},
): Promise<T> {
  const apiKey = options.apiKey || process.env.ZILLOW_API_KEY;

  if (!apiKey) {
    throw new ZillowMissingCredentialsError();
  }

  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const host = options.host || DEFAULT_HOST;
  const fetchImpl = options.fetchImpl || fetch;

  const url = buildUrl(path, params, baseUrl);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": host,
    },
    signal: options.signal,
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new ZillowApiError("Zillow API returned a non-JSON response.", response.status, null);
    }
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Zillow API request failed with status ${response.status}`;
    throw new ZillowApiError(message, response.status, body);
  }

  return body as T;
}
