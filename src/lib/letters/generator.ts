import type { LetterContext, LetterGenerationResult, LetterSectionPayload } from "@/types/letters";

const DEFAULT_LETTER_MODEL = process.env.OPENAI_LETTER_MODEL || "gpt-4.1-mini";

const LETTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "header",
    "salutation",
    "body",
    "closing",
    "signature",
    "filingReminders",
    "attachments",
    "disclaimer",
  ],
  properties: {
    header: { type: "string", description: "Letterhead block including owner name, address, tax year." },
    salutation: {
      type: "string",
      description: "Formal greeting addressed to the appropriate authority (e.g., Board of Revision).",
    },
    body: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      description: "Ordered paragraphs written in persuasive, plain language.",
    },
    closing: {
      type: "string",
      description: "Closing phrase (e.g., 'Respectfully submitted').",
    },
    signature: {
      type: "string",
      description: "Owner name and optional contact info formatted as a single string.",
    },
    filingReminders: {
      type: "array",
      items: { type: "string" },
      description: "Bullet list of concrete filing steps and deadlines tailored to the county.",
    },
    attachments: {
      type: "array",
      items: { type: "string" },
      description: "Descriptions of evidence packets or supporting docs. Provide empty array if none.",
    },
    disclaimer: {
      type: "string",
      description: "Friendly reminder that Appeal Shark is not a law firm / no legal advice.",
    },
  },
};

function stringifyContext(context: LetterContext): string {
  const {
    assessment,
    analytics,
    valuationSource,
    savingsEstimate,
    countyMetadata,
  } = context;

  const lines: string[] = [];
  lines.push(`Owner Name: ${assessment.ownerName ?? "Unknown"}`);
  lines.push(`Parcel / Property ID: ${assessment.parcelId ?? "Unknown"}`);
  lines.push(`Property Address: ${assessment.propertyAddress ?? "Unknown"}`);
  lines.push(`Assessed Value: ${assessment.assessedValue ?? "Unknown"}`);
  lines.push(`Market Value: ${assessment.marketValue ?? "Unknown"}`);
  lines.push(`Valuation Source: ${valuationSource ?? "Unknown"}`);
  lines.push(`Estimated Savings: ${savingsEstimate ?? "Unknown"}`);
  lines.push(`Tax Year: ${assessment.taxYear ?? "Unknown"}`);
  lines.push(`Notice Date: ${assessment.assessmentDate ?? "Unknown"}`);
  lines.push(`Appeal Deadline: ${assessment.appealDeadline ?? "Unknown"}`);
  if (assessment.notes) {
    lines.push(`Additional Notes: ${assessment.notes}`);
  }

  if (analytics) {
    lines.push("Zillow Analytics:");
    if (analytics.projectedSavingsVsLatest !== null && analytics.projectedSavingsVsLatest !== undefined) {
      lines.push(`  Projected Savings vs Latest Tax Bill: $${analytics.projectedSavingsVsLatest}`);
    }
    if (analytics.projectedTaxAtMarket !== null && analytics.projectedTaxAtMarket !== undefined) {
      lines.push(`  Projected Tax at Market Value: $${analytics.projectedTaxAtMarket}`);
    }
    if (analytics.taxHistory?.length) {
      const historyLines = analytics.taxHistory.slice(0, 3).map(entry => {
        const year = entry.year ?? "Unknown";
        const assessed = entry.assessedValue ?? "Unknown";
        const taxPaid = entry.taxPaid ?? "Unknown";
        return `    Year ${year}: assessed=${assessed}, taxPaid=${taxPaid}`;
      });
      lines.push("  Recent Tax History:");
      lines.push(...historyLines);
    }
  }

  if (countyMetadata) {
    lines.push("County Guidance:");
    lines.push(`  Jurisdiction: ${countyMetadata.jurisdiction}`);
    if (countyMetadata.primaryAuthority) {
      lines.push(`  Primary Authority: ${countyMetadata.primaryAuthority}`);
    }
    if (countyMetadata.filingWindow) {
      const { start, end, notes } = countyMetadata.filingWindow;
      lines.push(`  Filing Window: start=${start ?? "n/a"}, end=${end ?? "n/a"}`);
      if (notes) {
        lines.push(`  Filing Notes: ${notes}`);
      }
    }
    if (countyMetadata.alternateWindows) {
      for (const [key, value] of Object.entries(countyMetadata.alternateWindows)) {
        lines.push(`  ${key} window: ${value.notes ?? "see calendar"}`);
        if (value.calendarUrl) {
          lines.push(`    Calendar: ${value.calendarUrl}`);
        }
      }
    }
    if (countyMetadata.submissionChannels.length) {
      lines.push("  Submission Channels:");
      for (const channel of countyMetadata.submissionChannels.slice(0, 4)) {
        const details = [channel.label, channel.value, channel.address, channel.url]
          .filter(Boolean)
          .join(" | ");
        lines.push(`    - ${channel.type}${details ? `: ${details}` : ""}`);
      }
    }
    if (countyMetadata.forms.length) {
      lines.push("  Common Forms:");
      for (const form of countyMetadata.forms.slice(0, 3)) {
        lines.push(`    - ${form.name}: ${form.url}`);
      }
    }
    if (countyMetadata.notes) {
      lines.push(`  County Notes: ${countyMetadata.notes}`);
    }
  }

  return lines.join("\n");
}

function coerceJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'''")) {
    return trimmed.replace(/^'''|'''$/g, "");
  }
  return trimmed;
}

export async function generateAppealLetter({
  context,
  apiKey,
  model = DEFAULT_LETTER_MODEL,
  fetchImpl = fetch,
}: {
  context: LetterContext;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<LetterGenerationResult> {
  if (!apiKey) {
    throw new Error("OpenAI API key is required for letter generation.");
  }

  const promptText = stringifyContext(context);

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
              text: "You are an expert property tax consultant creating persuasive homeowner appeal letters. Respond using the provided JSON schema. Keep tone professional, encouraging, and grounded in the supplied facts. Never fabricate data.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Build a property tax appeal letter using the following context:\n${promptText}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "appeal_letter",
          schema: LETTER_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 1200,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const error = payload?.error;
    if (error && typeof error === "object" && error !== null && "message" in error) {
      const message = (error as { message?: string }).message;
      if (message) {
        throw new Error(message);
      }
    }
    throw new Error(`OpenAI letter generation failed with status ${response.status}`);
  }

  let contentText: string | null = null;
  const outputText = payload.output_text;
  if (Array.isArray(outputText) && outputText.length > 0) {
    contentText = String(outputText[0]);
  }

  if (!contentText && Array.isArray(payload.output)) {
    for (const item of payload.output as Array<Record<string, unknown>>) {
      const contentItems = item.content;
      if (!Array.isArray(contentItems)) continue;
      for (const chunk of contentItems) {
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          contentText = String((chunk as { text: unknown }).text ?? "");
          break;
        }
      }
      if (contentText) break;
    }
  }

  if (!contentText) {
    throw new Error("OpenAI response did not include structured letter content.");
  }

  let sections: LetterSectionPayload;
  try {
    sections = JSON.parse(coerceJsonText(contentText)) as LetterSectionPayload;
  } catch (error) {
    throw new Error("Failed to parse structured letter JSON.");
  }

  const attachments = Array.isArray(sections.attachments)
    ? sections.attachments.map(item => String(item))
    : [];

  const normalizedSections: LetterSectionPayload = {
    ...sections,
    attachments,
  };

  return {
    sections: normalizedSections,
    usage: {
      model,
      inputTokens:
        typeof payload?.usage === "object" && payload.usage !== null
          ? ((payload.usage as Record<string, unknown>).input_tokens as number | null) ?? null
          : null,
      outputTokens:
        typeof payload?.usage === "object" && payload.usage !== null
          ? ((payload.usage as Record<string, unknown>).output_tokens as number | null) ?? null
          : null,
      totalTokens:
        typeof payload?.usage === "object" && payload.usage !== null
          ? ((payload.usage as Record<string, unknown>).total_tokens as number | null) ?? null
          : null,
    },
  };
}
