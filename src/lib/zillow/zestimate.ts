import { zillowRequest } from "@/lib/zillow/client";
import {
  type AddressComponents,
  type ZillowLookupOptions,
  type ZillowPropertyResponse,
  type ZillowSearchHit,
  type ZillowSearchResponse,
  type ZillowTaxHistoryEntry,
  type ZillowValuation,
  type ZillowValuationAnalytics,
} from "@/types/zillow";

const lookupCache = new Map<string, ZillowValuation>();

const STATE_ABBREVIATIONS = new Map<string, string>([
  ["alabama", "AL"],
  ["alaska", "AK"],
  ["arizona", "AZ"],
  ["arkansas", "AR"],
  ["california", "CA"],
  ["colorado", "CO"],
  ["connecticut", "CT"],
  ["delaware", "DE"],
  ["district of columbia", "DC"],
  ["florida", "FL"],
  ["georgia", "GA"],
  ["hawaii", "HI"],
  ["idaho", "ID"],
  ["illinois", "IL"],
  ["indiana", "IN"],
  ["iowa", "IA"],
  ["kansas", "KS"],
  ["kentucky", "KY"],
  ["louisiana", "LA"],
  ["maine", "ME"],
  ["maryland", "MD"],
  ["massachusetts", "MA"],
  ["michigan", "MI"],
  ["minnesota", "MN"],
  ["mississippi", "MS"],
  ["missouri", "MO"],
  ["montana", "MT"],
  ["nebraska", "NE"],
  ["nevada", "NV"],
  ["new hampshire", "NH"],
  ["new jersey", "NJ"],
  ["new mexico", "NM"],
  ["new york", "NY"],
  ["north carolina", "NC"],
  ["north dakota", "ND"],
  ["ohio", "OH"],
  ["oklahoma", "OK"],
  ["oregon", "OR"],
  ["pennsylvania", "PA"],
  ["rhode island", "RI"],
  ["south carolina", "SC"],
  ["south dakota", "SD"],
  ["tennessee", "TN"],
  ["texas", "TX"],
  ["utah", "UT"],
  ["vermont", "VT"],
  ["virginia", "VA"],
  ["washington", "WA"],
  ["west virginia", "WV"],
  ["wisconsin", "WI"],
  ["wyoming", "WY"],
]);

function normalizeStateToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return token;
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const lower = trimmed.toLowerCase();
  return STATE_ABBREVIATIONS.get(lower) ?? trimmed;
}

export function extractAddressComponents(
  rawAddress: string | null | undefined,
): AddressComponents | null {
  if (!rawAddress) {
    return null;
  }

  const normalized = rawAddress
    .replace(/\s*\n\s*/g, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,?\s*USA$/i, "")
    .trim();

  const commaPattern = /^(.+?),\s*([^,]+),\s*([^,]+)\s+(\d{5}(?:-\d{4})?)$/i;
  const commaMatch = normalized.match(commaPattern);

  if (commaMatch) {
    const [, addressLineRaw, cityRaw, stateRawRaw, zipRaw] = commaMatch;
    const addressLine = addressLineRaw.trim();
    const city = cityRaw.trim();

    if (addressLine && city) {
      const state = normalizeStateToken(stateRawRaw);
      return { addressLine, cityStateZip: `${city}, ${state} ${zipRaw}` };
    }
  }

  const trailingPattern = /^(.+)\s+([^\s,]+)\s+(\d{5}(?:-\d{4})?)$/i;
  const trailingMatch = normalized.match(trailingPattern);

  if (trailingMatch) {
    const [, leftRaw, stateRawRaw, zipRaw] = trailingMatch;
    const words = leftRaw.trim().split(/\s+/);
    const suffixes = new Set([
      "st",
      "street",
      "rd",
      "road",
      "ave",
      "avenue",
      "blvd",
      "boulevard",
      "dr",
      "drive",
      "ln",
      "lane",
      "way",
      "pkwy",
      "parkway",
      "pl",
      "place",
      "plz",
      "plaza",
      "ct",
      "court",
      "trl",
      "trail",
      "cir",
      "circle",
      "terr",
      "terrace",
      "sq",
      "square",
      "hwy",
      "highway",
      "loop",
    ]);

    let suffixIndex = -1;

    for (let i = 1; i < words.length; i += 1) {
      if (suffixes.has(words[i].toLowerCase())) {
        suffixIndex = i;
      }
    }

    if (suffixIndex !== -1 && suffixIndex < words.length - 1) {
      const addressLine = words
        .slice(0, suffixIndex + 1)
        .join(" ")
        .trim();
      const city = words
        .slice(suffixIndex + 1)
        .join(" ")
        .trim();

      if (addressLine && city) {
        const state = normalizeStateToken(stateRawRaw);
        return { addressLine, cityStateZip: `${city}, ${state} ${zipRaw}` };
      }
    }

    let candidate: { addressLine: string; city: string } | null = null;

    for (let i = 1; i < words.length; i += 1) {
      const addressCandidate = words
        .slice(0, words.length - i)
        .join(" ")
        .trim();
      const cityCandidate = words
        .slice(words.length - i)
        .join(" ")
        .trim();

      if (
        /\d/.test(addressCandidate) &&
        /[a-zA-Z]/.test(addressCandidate) &&
        cityCandidate.length > 0
      ) {
        candidate = { addressLine: addressCandidate, city: cityCandidate };
      }
    }

    if (candidate) {
      return {
        addressLine: candidate.addressLine,
        cityStateZip: `${candidate.city}, ${normalizeStateToken(stateRawRaw)} ${zipRaw}`,
      };
    }
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.]/g, "");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function deriveAmount(
  searchHit: ZillowSearchHit | null,
  property: ZillowPropertyResponse | null,
): number | null {
  const candidates: Array<number | null> = [
    toNumber(property?.zestimate),
    toNumber((property as { homeValue?: unknown })?.homeValue),
    toNumber(property?.price),
    toNumber((property?.details as { price?: unknown } | undefined)?.price),
    toNumber(searchHit?.zestimate),
    toNumber(searchHit?.price),
  ];

  for (const candidate of candidates) {
    if (candidate !== null) {
      return Math.round(candidate);
    }
  }

  return null;
}

function deriveCurrency(
  searchHit: ZillowSearchHit | null,
  property: ZillowPropertyResponse | null,
): string | null {
  const candidates = [
    property?.currency,
    (property?.details as { currency?: unknown } | undefined)?.currency,
    searchHit?.currency,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim().toUpperCase();
    }
  }

  return "USD";
}

function deriveConfidence(property: ZillowPropertyResponse | null): string | null {
  const confidence = (property?.details as { confidence?: unknown } | undefined)?.confidence;

  if (typeof confidence === "string") {
    return confidence;
  }

  return null;
}

function deriveValuationDate(property: ZillowPropertyResponse | null): Date | null {
  const raw = (property?.details as { valuationDate?: unknown } | undefined)?.valuationDate;
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function toYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    const year = date.getUTCFullYear();
    if (!Number.isNaN(year) && year > 1000) {
      return year;
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric)) {
      const date = new Date(numeric);
      const year = date.getUTCFullYear();
      if (!Number.isNaN(year) && year > 1000) {
        return year;
      }
    }

    const parsedInt = Number.parseInt(value, 10);
    if (Number.isFinite(parsedInt) && parsedInt > 1000 && parsedInt < 9999) {
      return parsedInt;
    }
  }

  return null;
}

function parseTaxHistory(property: ZillowPropertyResponse | null): ZillowTaxHistoryEntry[] {
  const raw = (property as { taxHistory?: unknown } | null | undefined)?.taxHistory;

  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: ZillowTaxHistoryEntry[] = [];

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const year = toYear(record.time ?? record.year);
    if (year === null) {
      continue;
    }

    const assessedValue = toNumber(record.value ?? record.assessedValue);
    const taxPaid = toNumber(record.taxPaid ?? record.taxAmount);
    const taxIncreaseRate = toNumber(record.taxIncreaseRate);
    const valueIncreaseRate = toNumber(record.valueIncreaseRate);

    const effectiveTaxRate =
      assessedValue && assessedValue > 0 && taxPaid !== null ? taxPaid / assessedValue : null;

    entries.push({
      year,
      assessedValue,
      taxPaid,
      taxIncreaseRate,
      valueIncreaseRate,
      effectiveTaxRate,
    });
  }

  entries.sort((a, b) => b.year - a.year);

  return entries.slice(0, 10);
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (filtered.length === 0) {
    return null;
  }
  return filtered.reduce((total, value) => total + value, 0) / filtered.length;
}

function deriveValuationRange(property: ZillowPropertyResponse | null, zestimate: number | null) {
  const highPercentRaw = (property as { zestimateHighPercent?: unknown } | null | undefined)
    ?.zestimateHighPercent;
  const highPercent = toNumber(highPercentRaw);

  if (!zestimate || highPercent === null) {
    return {
      highEstimate: null,
      highPercent,
    };
  }

  const normalizedPercent = highPercent / 100;
  const highEstimate = Number.isFinite(normalizedPercent)
    ? Math.round(zestimate * (1 + normalizedPercent))
    : null;

  return {
    highEstimate,
    highPercent,
  };
}

function derivePropertyFacts(
  property: ZillowPropertyResponse | null,
): ZillowValuationAnalytics["propertyFacts"] {
  const detail = property as
    | (ZillowPropertyResponse & {
        livingAreaValue?: unknown;
        livingArea?: unknown;
        bedrooms?: unknown;
        bathroomsFloat?: unknown;
        bathrooms?: unknown;
        pricePerSquareFoot?: unknown;
      })
    | null
    | undefined;

  const livingArea = toNumber(detail?.livingAreaValue ?? detail?.livingArea);
  const bedrooms = toNumber(detail?.bedrooms);
  const bathrooms = toNumber(detail?.bathroomsFloat ?? detail?.bathrooms);
  const pricePerSquareFoot = toNumber(detail?.pricePerSquareFoot);

  return {
    livingArea,
    bedrooms,
    bathrooms,
    pricePerSquareFoot,
  };
}

function deriveLatestSale(property: ZillowPropertyResponse | null) {
  const rawHistory = (property as { priceHistory?: unknown } | null | undefined)?.priceHistory;

  if (!Array.isArray(rawHistory)) {
    return null;
  }

  type ParsedHistory = {
    price: number | null;
    timestamp: number | null;
    dateString: string | null;
    source: string | null;
    event: string | null;
  };

  const parsed: ParsedHistory[] = rawHistory
    .map(entry => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const event = typeof record.event === "string" ? record.event.trim() : null;
      const price = toNumber(record.price);
      const timestamp = toNumber(record.time);
      const rawDate = typeof record.date === "string" ? record.date.trim() : null;
      const source = typeof record.source === "string" ? record.source.trim() : null;

      return {
        event,
        price,
        timestamp,
        dateString: rawDate,
        source,
      } satisfies ParsedHistory;
    })
    .filter((value): value is ParsedHistory => value !== null && typeof value.event === "string");

  const sales = parsed.filter(entry => entry.event && entry.event.toLowerCase().includes("sold"));

  if (sales.length === 0) {
    return null;
  }

  const resolveTime = (value: number | null | undefined, dateString: string | null) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (dateString) {
      const parsed = new Date(dateString);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.getTime();
      }
    }

    return Number.NEGATIVE_INFINITY;
  };

  sales.sort(
    (a, b) => resolveTime(b.timestamp, b.dateString) - resolveTime(a.timestamp, a.dateString),
  );

  const latest = sales[0];

  if (!latest) {
    return null;
  }

  let isoDate: string | null = null;

  if (latest.dateString) {
    const parsedDate = new Date(latest.dateString);
    if (!Number.isNaN(parsedDate.getTime())) {
      isoDate = parsedDate.toISOString();
    }
  }

  if (!isoDate && latest.timestamp !== null) {
    const parsedDate = new Date(latest.timestamp);
    if (!Number.isNaN(parsedDate.getTime())) {
      isoDate = parsedDate.toISOString();
    }
  }

  return {
    price: latest.price,
    date: isoDate,
    source: latest.source,
  };
}

function deriveAnalytics(
  property: ZillowPropertyResponse | null,
  marketValue: number | null,
): ZillowValuationAnalytics | null {
  if (!property) {
    return null;
  }

  const taxHistory = parseTaxHistory(property);
  const latest = taxHistory[0] ?? null;
  const prior = taxHistory[1] ?? null;

  const averageEffectiveTaxRate = average(
    taxHistory.slice(0, 5).map(entry => entry.effectiveTaxRate ?? null),
  );

  const projectedTaxAtMarket =
    marketValue !== null && averageEffectiveTaxRate !== null
      ? Math.round(marketValue * averageEffectiveTaxRate)
      : null;

  const projectedSavingsVsLatest =
    latest && latest.taxPaid !== null && projectedTaxAtMarket !== null
      ? Math.round(latest.taxPaid - projectedTaxAtMarket)
      : null;

  const countyFipsRaw = (property as { countyFIPS?: unknown } | null | undefined)?.countyFIPS;
  const countyFips =
    typeof countyFipsRaw === "string" && countyFipsRaw.trim().length > 0 ? countyFipsRaw : null;

  return {
    countyFips,
    valuationRange: deriveValuationRange(property, marketValue),
    taxHistory,
    latest: latest
      ? {
          year: latest.year,
          assessedValue: latest.assessedValue,
          taxPaid: latest.taxPaid,
          effectiveTaxRate: latest.effectiveTaxRate,
          taxChangeAmount:
            latest.taxPaid !== null && prior?.taxPaid !== null
              ? Math.round(latest.taxPaid - prior.taxPaid)
              : null,
          effectiveRateDelta:
            latest.effectiveTaxRate !== null && prior?.effectiveTaxRate !== null
              ? latest.effectiveTaxRate - prior.effectiveTaxRate
              : null,
        }
      : null,
    averageEffectiveTaxRate,
    projectedTaxAtMarket,
    projectedSavingsVsLatest,
    propertyFacts: derivePropertyFacts(property),
    latestSale: deriveLatestSale(property),
  };
}

function extractSearchHits(response: ZillowSearchResponse | null | undefined): ZillowSearchHit[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const hits: ZillowSearchHit[] = [];
  const seenObjects = new Set<unknown>();
  const seenZpids = new Set<string>();

  const isSearchHit = (value: unknown): value is ZillowSearchHit => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as ZillowSearchHit;
    const rawZpid = candidate.zpid;
    if (typeof rawZpid === "string" || typeof rawZpid === "number") {
      return true;
    }

    if (typeof candidate.address === "string" && candidate.address.trim().length > 0) {
      return true;
    }

    if (typeof candidate.price === "number") {
      return true;
    }

    if (typeof candidate.price === "string" && candidate.price.trim().length > 0) {
      return true;
    }

    return false;
  };

  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, depth + 1);
      }
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (seenObjects.has(value)) {
      return;
    }
    seenObjects.add(value);

    if (isSearchHit(value)) {
      const rawZpid = value.zpid;
      const zpid =
        typeof rawZpid === "number"
          ? String(rawZpid)
          : typeof rawZpid === "string"
            ? rawZpid
            : null;

      if (!zpid || !seenZpids.has(zpid)) {
        if (zpid) {
          seenZpids.add(zpid);
        }
        hits.push(value);
      }
    }

    for (const child of Object.values(value)) {
      visit(child, depth + 1);
    }
  };

  visit(response, 0);

  return hits;
}

export async function lookupZillowValuation(
  rawAddress: string,
  options: ZillowLookupOptions = {},
): Promise<ZillowValuation | null> {
  const components = extractAddressComponents(rawAddress);

  const cacheKey = components
    ? `${components.addressLine.toLowerCase()}|${components.cityStateZip.toLowerCase()}`
    : null;

  if (cacheKey && options.useCache !== false && lookupCache.has(cacheKey)) {
    return lookupCache.get(cacheKey) ?? null;
  }

  const locationQuery = components
    ? `${components.addressLine} ${components.cityStateZip}`
    : rawAddress.replace(/\s+/g, " ").trim();

  if (!locationQuery) {
    return null;
  }
  const searchResponse = await zillowRequest<ZillowSearchResponse>(
    "/propertyExtendedSearch",
    {
      location: locationQuery,
    },
    options,
  );

  const hits = extractSearchHits(searchResponse);
  const bestHit = hits.find(hit => hit?.zpid !== undefined) ?? hits[0] ?? null;

  if (!bestHit) {
    return null;
  }

  const zpidRaw = bestHit.zpid ?? null;
  const zpid =
    typeof zpidRaw === "string" ? zpidRaw : typeof zpidRaw === "number" ? String(zpidRaw) : null;

  let propertyDetail: ZillowPropertyResponse | null = null;

  if (zpid) {
    propertyDetail = await zillowRequest<ZillowPropertyResponse>(
      "/property",
      { zpid, details: true },
      options,
    );
  }

  const amount = deriveAmount(bestHit, propertyDetail);
  const currency = deriveCurrency(bestHit, propertyDetail);
  const confidence = deriveConfidence(propertyDetail);
  const valuationDate = deriveValuationDate(propertyDetail);
  const analytics = deriveAnalytics(propertyDetail, amount);

  const valuation: ZillowValuation = {
    provider: "zillow",
    zpid,
    amount,
    currency,
    confidence,
    valuationDate,
    searchHit: bestHit,
    propertyDetail,
    analytics,
  };

  if (cacheKey) {
    lookupCache.set(cacheKey, valuation);
  }

  return valuation;
}

export function clearZillowLookupCache() {
  lookupCache.clear();
}
