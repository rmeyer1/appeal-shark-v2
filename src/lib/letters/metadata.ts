import type { CountyMetadata } from "@/types/letters";
import type { AssessmentExtraction } from "@/types/openai";
import type { ZillowValuationAnalytics } from "@/types/zillow";
import pilotCountyMetadata from "@/data/pilot-counties.json";

const PILOT_FIPS_TO_KEY: Record<string, string> = {
  "39049": "franklin_oh",
  "17031": "cook_il",
  "48453": "travis_tx",
};

type PilotCountyMetadata = Record<string, unknown>;

const cachedMetadata: PilotCountyMetadata = pilotCountyMetadata as PilotCountyMetadata;

function extractPrimaryAuthority(meta: Record<string, unknown>): string | null {
  if (typeof meta.appeal_authority === "object" && meta.appeal_authority !== null) {
    const authority = meta.appeal_authority as { name?: string };
    if (typeof authority.name === "string" && authority.name.trim()) {
      return authority.name.trim();
    }
  }

  if (typeof meta.appeal_authorities === "object" && meta.appeal_authorities !== null) {
    const authorities = meta.appeal_authorities as Record<string, { name?: string }>;
    for (const value of Object.values(authorities)) {
      if (value?.name) {
        return value.name;
      }
    }
  }

  return null;
}

function mapSubmissionChannels(meta: Record<string, unknown>): CountyMetadata["submissionChannels"] {
  const channels: CountyMetadata["submissionChannels"] = [];

  const raw = (meta.submission_channels ?? meta.submissionChannels) as unknown;

  if (Array.isArray(raw)) {
    for (const channel of raw) {
      if (!channel || typeof channel !== "object") continue;
      const c = channel as Record<string, unknown>;
      channels.push({
        type: String(c.type ?? "unknown"),
        label: typeof c.label === "string" ? c.label : undefined,
        url: typeof c.url === "string" ? c.url : undefined,
        value: typeof c.value === "string" ? c.value : undefined,
        address: typeof c.address === "string" ? c.address : undefined,
        note: typeof c.note === "string" ? c.note : undefined,
        postmarkRequirement:
          typeof c.postmark_requirement === "string" ? c.postmark_requirement : undefined,
      });
    }
  } else if (raw && typeof raw === "object") {
    const grouped = raw as Record<string, unknown>;
    for (const groupChannels of Object.values(grouped)) {
      if (!Array.isArray(groupChannels)) continue;
      for (const channel of groupChannels) {
        if (!channel || typeof channel !== "object") continue;
        const c = channel as Record<string, unknown>;
        channels.push({
          type: String(c.type ?? "unknown"),
          label: typeof c.label === "string" ? c.label : undefined,
          url: typeof c.url === "string" ? c.url : undefined,
          value: typeof c.value === "string" ? c.value : undefined,
          address: typeof c.address === "string" ? c.address : undefined,
          note: typeof c.note === "string" ? c.note : undefined,
          postmarkRequirement:
            typeof c.postmark_requirement === "string" ? c.postmark_requirement : undefined,
        });
      }
    }
  }

  return channels;
}

function mapForms(meta: Record<string, unknown>): CountyMetadata["forms"] {
  const forms: CountyMetadata["forms"] = [];
  const raw = meta.forms as unknown;

  if (Array.isArray(raw)) {
    for (const form of raw) {
      if (!form || typeof form !== "object") continue;
      const f = form as Record<string, unknown>;
      if (typeof f.name === "string" && typeof f.url === "string") {
        forms.push({ name: f.name, url: f.url });
      }
    }
  } else if (raw && typeof raw === "object") {
    const grouped = raw as Record<string, unknown>;
    for (const value of Object.values(grouped)) {
      if (!Array.isArray(value)) continue;
      for (const form of value) {
        if (!form || typeof form !== "object") continue;
        const f = form as Record<string, unknown>;
        if (typeof f.name === "string" && typeof f.url === "string") {
          forms.push({ name: f.name, url: f.url });
        }
      }
    }
  }

  return forms;
}

function mapFilingWindow(meta: Record<string, unknown>): CountyMetadata["filingWindow"] {
  const window = meta.filing_window ?? meta.filingWindow ?? meta.filing_deadline;
  if (!window || typeof window !== "object") {
    return undefined;
  }
  const w = window as Record<string, unknown>;
  return {
    start: typeof w.start_date === "string" ? w.start_date : typeof w.start === "string" ? w.start : null,
    end: typeof w.end_date === "string" ? w.end_date : typeof w.end === "string" ? w.end : null,
    notes: typeof w.notes === "string" ? w.notes : null,
    timezone: typeof w.timezone === "string" ? w.timezone : null,
  };
}

function mapAlternateWindows(meta: Record<string, unknown>): CountyMetadata["alternateWindows"] {
  const raw = meta.filing_windows ?? meta.filingWindows;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const result: Record<string, { notes?: string | null; calendarUrl?: string | null }> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    result[key] = {
      notes: typeof v.notes === "string" ? v.notes : null,
      calendarUrl: typeof v.calendar_url === "string" ? v.calendar_url : null,
    };
  }
  return result;
}

export async function resolveCountyMetadata(
  analytics: ZillowValuationAnalytics | null,
  assessment: AssessmentExtraction,
): Promise<CountyMetadata | null> {
  const metadata = cachedMetadata;

  let key: string | undefined;
  const countyFips = analytics?.countyFips ?? undefined;
  if (countyFips && PILOT_FIPS_TO_KEY[countyFips]) {
    key = PILOT_FIPS_TO_KEY[countyFips];
  }

  if (!key) {
    const address = assessment.propertyAddress?.toLowerCase() ?? "";
    if (address.includes("franklin") && address.includes("oh")) {
      key = "franklin_oh";
    } else if (address.includes("cook") && address.includes("il")) {
      key = "cook_il";
    } else if (address.includes("travis") && address.includes("tx")) {
      key = "travis_tx";
    }
  }

  if (!key) {
    return null;
  }

  const rawMeta = metadata[key];
  if (!rawMeta || typeof rawMeta !== "object") {
    return null;
  }
  const meta = rawMeta as Record<string, unknown>;

  return {
    jurisdiction: typeof meta.jurisdiction === "string" ? meta.jurisdiction : key,
    taxYear:
      typeof meta.tax_year === "number"
        ? meta.tax_year
        : typeof meta.tax_year === "string"
          ? meta.tax_year
          : null,
    primaryAuthority: extractPrimaryAuthority(meta),
    notes: typeof meta.notes === "string" ? meta.notes : null,
    filingWindow: mapFilingWindow(meta),
    alternateWindows: mapAlternateWindows(meta),
    submissionChannels: mapSubmissionChannels(meta),
    forms: mapForms(meta),
  };
}
