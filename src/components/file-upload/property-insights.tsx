import type { DerivedValuation } from "@/types/assessment";
import { formatCurrency, formatDate } from "@/components/file-upload/formatters";

type PropertyInsightsProps = {
  valuation: DerivedValuation | null;
};

function formatLivingArea(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return `${Math.round(value).toLocaleString()} sqft`;
}

function formatBedrooms(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Number.isInteger(value) ? `${value} bd` : `${value.toFixed(1)} bd`;
}

function formatBathrooms(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Number.isInteger(value) ? `${value} ba` : `${value.toFixed(1)} ba`;
}

export default function PropertyInsights({ valuation }: PropertyInsightsProps) {
  const analytics = valuation?.analytics ?? null;
  const propertyFacts = analytics?.propertyFacts ?? null;
  const latestSale = analytics?.latestSale ?? null;

  const hasFacts =
    !!propertyFacts &&
    (propertyFacts.livingArea !== null ||
      propertyFacts.bedrooms !== null ||
      propertyFacts.bathrooms !== null);

  const zestimate = valuation?.zillow?.amount ?? valuation?.marketValue ?? null;
  const zestimateDate = valuation?.zillow?.valuationDate ?? null;
  const zestimateConfidence = valuation?.zillow?.confidence ?? null;

  const livingArea = propertyFacts ? formatLivingArea(propertyFacts.livingArea) : null;
  const bedrooms = propertyFacts ? formatBedrooms(propertyFacts.bedrooms) : null;
  const bathrooms = propertyFacts ? formatBathrooms(propertyFacts.bathrooms) : null;
  const pricePerSqFt = propertyFacts?.pricePerSquareFoot ?? null;

  const propertyFactsSummary =
    [livingArea, bedrooms, bathrooms].filter(Boolean).join(" · ") || null;

  const latestSalePrice = formatCurrency(latestSale?.price ?? null);
  const latestSaleDate = formatDate(latestSale?.date ?? null);
  const countyFips = analytics?.countyFips ?? null;

  if (!analytics && zestimate === null) {
    return null;
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <section className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Zestimate snapshot
        </h3>
        <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <dt className="font-medium">Current estimate</dt>
            <dd>{formatCurrency(zestimate) ?? "Not available"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium">Confidence</dt>
            <dd>{zestimateConfidence ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium">Updated</dt>
            <dd>{formatDate(zestimateDate) ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Pulled directly from Zillow. We’ll refresh this after each appeal run.
        </p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Property facts</h3>
        {hasFacts ? (
          <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {livingArea ? (
              <div className="flex items-center justify-between">
                <dt className="font-medium">Living area</dt>
                <dd>{livingArea}</dd>
              </div>
            ) : null}
            {bedrooms ? (
              <div className="flex items-center justify-between">
                <dt className="font-medium">Bedrooms</dt>
                <dd>{bedrooms}</dd>
              </div>
            ) : null}
            {bathrooms ? (
              <div className="flex items-center justify-between">
                <dt className="font-medium">Bathrooms</dt>
                <dd>{bathrooms}</dd>
              </div>
            ) : null}
            {pricePerSqFt !== null ? (
              <div className="flex items-center justify-between">
                <dt className="font-medium">Price / sqft</dt>
                <dd>{formatCurrency(pricePerSqFt) ?? "—"}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Zillow did not return detailed property facts for this address.
          </p>
        )}
        {propertyFactsSummary ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{propertyFactsSummary}</p>
        ) : null}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          County & sale history
        </h3>
        <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <dt className="font-medium">County FIPS</dt>
            <dd>{countyFips ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium">Latest purchase</dt>
            <dd className="text-right">
              {latestSalePrice ?? "Unavailable"}
              {latestSaleDate ? (
                <span className="block text-xs text-slate-500">Closed {latestSaleDate}</span>
              ) : null}
            </dd>
          </div>
          {latestSale?.source ? (
            <div className="flex items-center justify-between">
              <dt className="font-medium">Source</dt>
              <dd>{latestSale.source}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          We use county FIPS to match the right filing instructions and appeal templates.
        </p>
      </section>
    </div>
  );
}
