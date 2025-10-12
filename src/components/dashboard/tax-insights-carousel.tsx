"use client";

import { useEffect, useMemo, useState } from "react";
import type { TaxInsightsCarouselCard, TaxInsightsCarouselProps } from "@/types/dashboard";
import {
  formatCurrency,
  formatCurrencySigned,
  formatDate,
  formatMillage,
  formatRatePercent,
  formatRatioPercent,
} from "@/components/file-upload/formatters";

const CARDS_PER_VIEW = 3;

export default function TaxInsightsCarousel({ valuation }: TaxInsightsCarouselProps) {
  const cards = useMemo(() => buildCards(valuation), [valuation]);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (startIndex >= cards.length && cards.length > 0) {
      setStartIndex(0);
    }
  }, [cards.length, startIndex]);

  const showControls = cards.length > CARDS_PER_VIEW;
  const visibleCount = Math.min(cards.length, CARDS_PER_VIEW);
  const visibleCards = useMemo(() => {
    if (cards.length === 0) {
      return [];
    }

    if (!showControls) {
      return cards;
    }

    return Array.from({ length: visibleCount }, (_, offset) => {
      const index = (startIndex + offset) % cards.length;
      return cards[index];
    });
  }, [cards, showControls, startIndex, visibleCount]);

  const totalSlides = cards.length === 0 ? 0 : Math.ceil(cards.length / CARDS_PER_VIEW);
  const activeSlide = cards.length === 0 ? 0 : Math.floor(startIndex / CARDS_PER_VIEW) + 1;

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">
          We model how your annual tax bill could shift if the assessment aligns with Zillow’s market view.
        </p>
        <div className="flex items-center gap-2">
          {showControls ? (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
              Viewing {activeSlide} of {totalSlides}
            </span>
          ) : null}
          <CarouselButton
            direction="previous"
            onClick={() => setStartIndex(prev => (prev - CARDS_PER_VIEW + cards.length) % cards.length)}
            disabled={!showControls}
          />
          <CarouselButton
            direction="next"
            onClick={() => setStartIndex(prev => (prev + CARDS_PER_VIEW) % cards.length)}
            disabled={!showControls}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {visibleCards.map(card => (
          <div key={card.id}>{card.content}</div>
        ))}
      </div>
    </div>
  );
}

function CarouselButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const label = direction === "previous" ? "Show previous insights" : "Show next insights";
  const arrow = direction === "previous" ? "←" : "→";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-base font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-900"
      aria-label={label}
      disabled={disabled}
    >
      <span aria-hidden>{arrow}</span>
    </button>
  );
}

function buildCards(valuation: TaxInsightsCarouselProps["valuation"]): TaxInsightsCarouselCard[] {
  if (!valuation) {
    return [];
  }

  const cards: TaxInsightsCarouselCard[] = [];
  const analytics = valuation.analytics;

  if (analytics) {
    cards.push(
      {
        id: "latest-tax",
        content: (
          <section className="h-full rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Latest tax bill</h4>
            <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Amount</dt>
                <dd>{formatCurrency(analytics.latest?.taxPaid ?? null) ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Tax year</dt>
                <dd>{analytics.latest?.year ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Taxable value</dt>
                <dd>{formatCurrency(analytics.latest?.assessedValue ?? null) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Effective rate</dt>
                <dd>{formatRatePercent(analytics.latest?.effectiveTaxRate ?? null) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Effective millage</dt>
                <dd>{formatMillage(analytics.latest?.millageRate ?? null) ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Based on the most recent tax history Zillow provided for this parcel and the county taxable base.
            </p>
          </section>
        ),
      },
      {
        id: "projected-tax",
        content: (
          <section className="h-full rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Projected after adjustment</h4>
            <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Projected tax</dt>
                <dd>{formatCurrency(analytics.projectedTaxAtMarket ?? null) ?? "Model unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Modeled effective rate</dt>
                <dd>{formatRatePercent(analytics.averageEffectiveTaxRate ?? null) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Average millage used</dt>
                <dd>{formatMillage(analytics.averageMillageRate ?? null) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Assessment ratio</dt>
                <dd>{formatRatioPercent(analytics.assessmentRatioUsed ?? null) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Market value source</dt>
                <dd className="text-right">
                  {valuation.marketSource ?? "Zillow"}
                  {valuation.zillow?.valuationDate ? (
                    <span className="block text-xs text-slate-500">
                      Updated {formatDate(valuation.zillow.valuationDate) ?? "recently"}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Zillow models what your bill would be if the assessment aligned with its current valuation.
            </p>
          </section>
        ),
      },
      {
        id: "estimated-change",
        content: (
          <section
            className={`h-full rounded-md border p-5 ${
              analytics.projectedSavingsVsLatest !== null && analytics.projectedSavingsVsLatest > 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/60 dark:bg-emerald-900/30"
                : analytics.projectedSavingsVsLatest !== null && analytics.projectedSavingsVsLatest < 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-400/60 dark:bg-amber-900/30"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
            }`}
          >
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Estimated annual change</h4>
            <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {analytics.projectedSavingsVsLatest === null
                ? "—"
                : formatCurrency(Math.abs(analytics.projectedSavingsVsLatest)) ?? "—"}
            </p>
            <p
              className={`mt-2 text-sm ${
                analytics.projectedSavingsVsLatest !== null && analytics.projectedSavingsVsLatest > 0
                  ? "text-emerald-700 dark:text-emerald-200"
                  : analytics.projectedSavingsVsLatest !== null && analytics.projectedSavingsVsLatest < 0
                    ? "text-amber-700 dark:text-amber-200"
                    : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {analytics.projectedSavingsVsLatest === null
                ? "Awaiting projection"
                : analytics.projectedSavingsVsLatest > 0
                  ? `Potential annual savings if the county keeps its ${
                      formatRatioPercent(analytics.assessmentRatioUsed ?? null) ?? "local taxable ratio"
                    } and current millage.`
                  : analytics.projectedSavingsVsLatest < 0
                    ? `Model suggests taxes could increase under the same ${
                        formatRatioPercent(analytics.assessmentRatioUsed ?? null) ?? "local taxable ratio"
                      }.`
                    : "No material change projected."}
            </p>
            {valuation.savings !== null ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Raw valuation delta: {formatCurrencySigned(valuation.savings)} (assessed vs. market). Actual tax outcomes depend on local rules and exemptions.
              </p>
            ) : null}
            {formatRatioPercent(analytics.assessmentRatioUsed ?? null) ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Calculations use the county’s {formatRatioPercent(analytics.assessmentRatioUsed ?? null)} taxable ratio to convert market value into the base.
              </p>
            ) : null}
          </section>
        ),
      },
    );
  } else {
    cards.push({
      id: "pending-tax-analytics",
      content: (
        <section className="h-full rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          We’re still gathering tax data for this property. Once Zillow returns projected tax details you’ll see a breakdown of current bill vs projected savings here.
        </section>
      ),
    });
  }

  cards.push(...buildPropertyCards(valuation));

  return cards;
}

function buildPropertyCards(valuation: NonNullable<TaxInsightsCarouselProps["valuation"]>): TaxInsightsCarouselCard[] {
  const analytics = valuation.analytics ?? null;
  const propertyFacts = analytics?.propertyFacts ?? null;
  const latestSale = analytics?.latestSale ?? null;
  const zestimate = valuation.zillow?.amount ?? valuation.marketValue ?? null;

  if (!analytics && zestimate === null) {
    return [];
  }

  const zestimateConfidence = valuation.zillow?.confidence ?? null;
  const zestimateDate = valuation.zillow?.valuationDate ?? null;

  const livingArea = propertyFacts ? formatLivingArea(propertyFacts.livingArea) : null;
  const bedrooms = propertyFacts ? formatBedrooms(propertyFacts.bedrooms) : null;
  const bathrooms = propertyFacts ? formatBathrooms(propertyFacts.bathrooms) : null;
  const pricePerSqFt = propertyFacts?.pricePerSquareFoot ?? null;

  const propertyFactsSummary = [livingArea, bedrooms, bathrooms].filter(Boolean).join(" · ") || null;
  const latestSalePrice = formatCurrency(latestSale?.price ?? null);
  const latestSaleDate = formatDate(latestSale?.date ?? null);
  const countyFips = analytics?.countyFips ?? null;

  const hasFacts =
    !!propertyFacts &&
    (propertyFacts.livingArea !== null || propertyFacts.bedrooms !== null || propertyFacts.bathrooms !== null);

  const cards: TaxInsightsCarouselCard[] = [
    {
      id: "zestimate-snapshot",
      content: (
        <section className="h-full rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Zestimate snapshot</h4>
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
      ),
    },
  ];

  cards.push({
    id: "property-facts",
    content: (
      <section className="h-full rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Property facts</h4>
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
    ),
  });

  cards.push({
    id: "county-history",
    content: (
      <section className="h-full rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">County & sale history</h4>
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
    ),
  });

  return cards;
}

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
