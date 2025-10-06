import type { LetterContext } from "@/types/letters";
import type { AssessmentExtraction } from "@/types/openai";
import type { ApiValuation } from "@/types/assessment";
import type { CountyMetadata } from "@/types/letters";

export function buildLetterContext({
  assessment,
  valuation,
  countyMetadata,
}: {
  assessment: AssessmentExtraction;
  valuation: ApiValuation | null;
  countyMetadata: CountyMetadata | null;
}): LetterContext {
  const valuationSource = valuation?.provider ? valuation.provider : null;
  const savingsEstimate =
    assessment.assessedValue !== null && valuation?.amount !== null
      ? Math.round((assessment.assessedValue ?? 0) - (valuation?.amount ?? 0))
      : null;

  return {
    assessment,
    analytics: valuation?.analytics ?? null,
    valuationSource,
    savingsEstimate,
    countyMetadata,
  };
}
