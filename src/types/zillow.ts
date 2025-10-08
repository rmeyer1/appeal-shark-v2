export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export type ZillowRequestOptions = {
  apiKey?: string;
  baseUrl?: string;
  host?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export type AddressComponents = {
  addressLine: string;
  cityStateZip: string;
};

export type ZillowTaxHistoryEntry = {
  year: number;
  assessedValue: number | null;
  taxPaid: number | null;
  taxIncreaseRate: number | null;
  valueIncreaseRate: number | null;
  millageRate: number | null;
  effectiveTaxRate: number | null;
};

export type ZillowValuationAnalytics = {
  countyFips: string | null;
  assessmentRatioUsed: number | null;
  valuationRange: {
    highEstimate: number | null;
    highPercent: number | null;
  } | null;
  taxHistory: ZillowTaxHistoryEntry[];
  latest: {
    year: number;
    assessedValue: number | null;
    taxPaid: number | null;
    millageRate: number | null;
    effectiveTaxRate: number | null;
    taxChangeAmount: number | null;
    effectiveRateDelta: number | null;
  } | null;
  averageMillageRate: number | null;
  averageEffectiveTaxRate: number | null;
  projectedTaxAtMarket: number | null;
  projectedSavingsVsLatest: number | null;
  propertyFacts: {
    livingArea: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    pricePerSquareFoot: number | null;
  };
  latestSale: {
    price: number | null;
    date: string | null;
    source: string | null;
  } | null;
};

export type ZillowValuation = {
  provider: "zillow";
  zpid: string | null;
  amount: number | null;
  currency: string | null;
  confidence: string | null;
  valuationDate: Date | null;
  searchHit: ZillowSearchHit | null;
  propertyDetail: ZillowPropertyResponse | null;
  analytics: ZillowValuationAnalytics | null;
};

export type ZillowLookupOptions = ZillowRequestOptions & {
  useCache?: boolean;
};

export type ZillowSearchHit = {
  zpid?: string | number;
  address?: string;
  price?: number | string;
  zestimate?: number | string;
  currency?: string;
  [key: string]: unknown;
};

export type ZillowSearchResponse = {
  results?: ZillowSearchHit[];
  props?: ZillowSearchHit[];
  body?: { props?: ZillowSearchHit[]; [key: string]: unknown } | null;
  totalResults?: number;
  totalResultCount?: number;
  [key: string]: unknown;
};

export type ZillowPropertyResponse = {
  zpid?: string | number;
  address?: string;
  price?: number | string;
  zestimate?: number | string;
  currency?: string;
  details?: Record<string, unknown> | null;
  taxHistory?: unknown;
  [key: string]: unknown;
};
