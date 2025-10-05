import type { DerivedValuation } from "@/types/assessment";
import {
  formatCurrency,
  formatCurrencySigned,
  formatDate,
  formatRatePercent,
} from "@/components/file-upload/formatters";

type ValuationSummaryProps = {
  valuation: DerivedValuation | null;
};

export default function ValuationSummary({ valuation }: ValuationSummaryProps) {
  if (!valuation) {
    return null;
  }

  const analytics = valuation.analytics;

  if (!analytics) {
    return (
      <div className="mt-4 rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
        We’re still gathering tax data for this property. Once Zillow returns projected tax details
        you’ll see a breakdown of current bill vs projected savings here.
      </div>
    );
  }

  const latestTaxPaid = analytics.latest?.taxPaid ?? null;
  const latestYear = analytics.latest?.year ?? null;
  const latestEffectiveRate = analytics.latest?.effectiveTaxRate ?? null;
  const projectedTax = analytics.projectedTaxAtMarket ?? null;
  const projectedSavings = analytics.projectedSavingsVsLatest ?? null;
  const averageRate = analytics.averageEffectiveTaxRate ?? null;
  const hasSavings = projectedSavings !== null && projectedSavings > 0;
  const hasIncrease = projectedSavings !== null && projectedSavings < 0;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Latest tax bill
        </h4>
        <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Amount</dt>
            <dd>{formatCurrency(latestTaxPaid) ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Tax year</dt>
            <dd>{latestYear ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Effective rate</dt>
            <dd>{formatRatePercent(latestEffectiveRate) ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Based on the most recent tax history Zillow provided for this parcel.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Projected after adjustment
        </h4>
        <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Projected tax</dt>
            <dd>{formatCurrency(projectedTax) ?? "Model unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Modeled rate</dt>
            <dd>{formatRatePercent(averageRate) ?? "—"}</dd>
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
          Zillow models what your bill would be if the assessment aligned with its current
          valuation.
        </p>
      </div>

      <div
        className={`rounded-md border p-5 ${
          hasSavings
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/60 dark:bg-emerald-900/30"
            : hasIncrease
              ? "border-amber-200 bg-amber-50 dark:border-amber-400/60 dark:bg-amber-900/30"
              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
        }`}
      >
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Estimated annual change
        </h4>
        <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {projectedSavings === null ? "—" : (formatCurrency(Math.abs(projectedSavings)) ?? "—")}
        </p>
        <p
          className={`mt-2 text-sm ${
            hasSavings
              ? "text-emerald-700 dark:text-emerald-200"
              : hasIncrease
                ? "text-amber-700 dark:text-amber-200"
                : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {projectedSavings === null
            ? "Awaiting projection"
            : hasSavings
              ? "Potential annual savings if your assessed value is reduced to market."
              : hasIncrease
                ? "Model suggests taxes could increase if the valuation rises to market."
                : "No material change projected."}
        </p>
        {valuation.savings !== null ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Raw valuation delta: {formatCurrencySigned(valuation.savings)} (assessed vs. market).
            Actual tax outcomes depend on local rules.
          </p>
        ) : null}
      </div>
    </div>
  );
}
