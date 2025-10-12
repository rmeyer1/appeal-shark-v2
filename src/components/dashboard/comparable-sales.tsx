"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/components/file-upload/formatters";
import type { ComparableSalesProps } from "@/types/dashboard";

export default function ComparableSales({ sales, lastUpdatedIso }: ComparableSalesProps) {
  const summary = useMemo(() => {
    if (sales.length === 0) {
      return null;
    }

    const prices = sales.map(sale => sale.price).filter((value): value is number => typeof value === "number");
    if (prices.length === 0) {
      return null;
    }

    const average = prices.reduce((total, price) => total + price, 0) / prices.length;
    return {
      averagePrice: Math.round(average),
      count: prices.length,
    };
  }, [sales]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Nearby comparable sales</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Recent sold properties within your neighborhood help establish a realistic market value baseline.
          </p>
        </div>
        {summary ? (
          <div className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {summary.count} sale{summary.count === 1 ? "" : "s"} · Avg {formatCurrency(summary.averagePrice) ?? "—"}
          </div>
        ) : null}
      </header>

      {sales.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Zillow did not report any sold comparables in the last six months for this property. We recommend gathering recent comps manually if available.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {sales.slice(0, 3).map(sale => (
            <article
              key={sale.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950"
            >
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{sale.address}</h3>
              <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <dt className="font-medium">Sale price</dt>
                  <dd>{formatCurrency(sale.price) ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium">Square footage</dt>
                  <dd>{formatSquareFeet(sale.squareFeet)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium">Beds / baths</dt>
                  <dd>{formatBedBath(sale.bedrooms, sale.bathrooms)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium">$ / sqft</dt>
                  <dd>{formatCurrency(pricePerSqFt(sale.price, sale.squareFeet)) ?? "—"}</dd>
                </div>
              </dl>
              {sale.soldDate ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Sold on {formatDateLabel(sale.soldDate)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {lastUpdatedIso ? (
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          Updated {formatDateLabel(lastUpdatedIso)}
        </p>
      ) : null}
    </section>
  );
}

function pricePerSqFt(price: number | null, squareFeet: number | null): number | null {
  if (!price || !squareFeet || price <= 0 || squareFeet <= 0) {
    return null;
  }
  return Math.round(price / squareFeet);
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSquareFeet(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value).toLocaleString()} sqft`;
}

function formatBedBath(beds: number | null, baths: number | null): string {
  const formattedBeds = beds === null || Number.isNaN(beds) ? "—" : beds % 1 === 0 ? `${beds} bd` : `${beds.toFixed(1)} bd`;
  const formattedBaths = baths === null || Number.isNaN(baths) ? "—" : baths % 1 === 0 ? `${baths} ba` : `${baths.toFixed(1)} ba`;
  return `${formattedBeds} · ${formattedBaths}`;
}
