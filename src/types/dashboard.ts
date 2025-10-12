import type { JSX } from "react";
import type { DerivedValuation } from "@/types/assessment";

export type ComparableSale = {
  id: string;
  address: string;
  price: number | null;
  squareFeet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  soldDate: string | null;
};

export type ComparableSalesProps = {
  sales: ComparableSale[];
  lastUpdatedIso: string | null;
};

export type TaxInsightsCarouselProps = {
  valuation: DerivedValuation | null;
};

export type TaxInsightsCarouselCard = {
  id: string;
  content: JSX.Element;
};
