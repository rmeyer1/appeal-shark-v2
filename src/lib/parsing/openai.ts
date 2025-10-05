import type {
  AssessmentExtraction,
  AssessmentExtractionResult,
  ExtractAssessmentArgs,
  OpenAIErrorPayload,
  OpenAIResponse,
} from "@/types/openai";

const DEFAULT_MODEL = process.env.OPENAI_EXTRACTION_MODEL || "gpt-4o-mini-2024-07-18";

const ASSESSMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    parcelId: { type: ["string", "null"], description: "Parcel or property identifier." },
    ownerName: { type: ["string", "null"], description: "Primary owner name." },
    propertyAddress: { type: ["string", "null"], description: "Mailing or site address." },
    assessedValue: {
      type: ["number", "null"],
      description: "Assessed property value in dollars. Strip currency symbols.",
    },
    marketValue: {
      type: ["number", "null"],
      description: "Fair market value if provided.",
    },
    taxYear: { type: ["string", "null"], description: "Tax year covered by the assessment." },
    assessmentDate: {
      type: ["string", "null"],
      description: "Date the assessment notice was issued (ISO 8601 preferred).",
    },
    appealDeadline: {
      type: ["string", "null"],
      description: "Appeal deadline (ISO 8601 or human-readable if relative).",
    },
    notes: {
      type: ["string", "null"],
      description: "Any additional details relevant to the appeal workflow.",
    },
  },
  required: [
    "parcelId",
    "ownerName",
    "propertyAddress",
    "assessedValue",
    "marketValue",
    "taxYear",
    "assessmentDate",
    "appealDeadline",
    "notes",
  ],
};

function extractContentText(responseJson: OpenAIResponse): string | null {
  if (Array.isArray(responseJson.output_text) && responseJson.output_text.length > 0) {
    return responseJson.output_text[0] ?? null;
  }

  const outputItems = Array.isArray(responseJson.output) ? responseJson.output : [];
  for (const item of outputItems) {
    if (!item?.content) continue;
    for (const chunk of item.content) {
      if (chunk && "refusal" in chunk && chunk.refusal) {
        const message = chunk.refusal.message || chunk.refusal.reason || "Model refused to comply.";
        throw new Error(message);
      }
      if (chunk && typeof chunk === "object" && "text" in chunk && typeof chunk.text === "string") {
        return chunk.text;
      }
    }
  }

  return null;
}

function coerceJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("`")) {
    return trimmed.replace(/^[`\s]+|[`\s]+$/g, "");
  }
  return trimmed;
}

export async function extractAssessmentFields({
  text,
  apiKey,
  model = DEFAULT_MODEL,
  fetchImpl = fetch,
}: ExtractAssessmentArgs): Promise<AssessmentExtractionResult> {
  if (!text) {
    throw new Error("Assessment text is required for OpenAI extraction.");
  }

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are an expert property tax analyst. Extract key fields from assessment notices and respond strictly using the provided JSON schema.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Assessment notice text:\n${text}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "assessment_extraction",
          schema: ASSESSMENT_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 800,
    }),
  });

  const payload = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    const errorPayload = payload as OpenAIErrorPayload;
    const message =
      errorPayload.error?.message ||
      extractContentText(payload) ||
      `OpenAI extraction failed with status ${response.status}`;
    throw new Error(message);
  }

  const contentText = extractContentText(payload);
  if (!contentText) {
    throw new Error("OpenAI response did not include structured content.");
  }

  let parsed: AssessmentExtraction;
  try {
    parsed = JSON.parse(coerceJsonText(contentText)) as AssessmentExtraction;
  } catch {
    throw new Error("Failed to parse structured assessment JSON.");
  }

  const ensureKeys = [
    "parcelId",
    "ownerName",
    "propertyAddress",
    "assessedValue",
    "marketValue",
    "taxYear",
    "assessmentDate",
    "appealDeadline",
    "notes",
  ] as const;

  for (const key of ensureKeys) {
    if (!(key in parsed)) {
      throw new Error(`OpenAI response missing expected field: ${key}`);
    }
  }

  return {
    structured: parsed,
    usage: {
      model,
      inputTokens: payload?.usage?.input_tokens ?? null,
      outputTokens: payload?.usage?.output_tokens ?? null,
      totalTokens: payload?.usage?.total_tokens ?? null,
    },
  };
}

export type { AssessmentExtraction, AssessmentExtractionResult } from "@/types/openai";
