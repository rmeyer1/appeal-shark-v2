import type { ParsingResponse } from "@/types/assessment";
import { formatCurrency } from "@/components/file-upload/formatters";

type AssessmentSummaryDetailsProps = {
  assessment: ParsingResponse;
};

export default function AssessmentSummaryDetails({ assessment }: AssessmentSummaryDetailsProps) {
  const { extracted, metadata } = assessment;

  return (
    <>
      <dl className="mt-3 space-y-2 text-sm text-slate-600">
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Parcel ID</dt>
          <dd>{extracted.parcelId ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Owner</dt>
          <dd>{extracted.ownerName ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Address</dt>
          <dd className="max-w-[12rem] truncate" title={extracted.propertyAddress ?? "Not found"}>
            {extracted.propertyAddress ?? "Not found"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Assessed Value</dt>
          <dd>{formatCurrency(extracted.assessedValue) ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Market Value</dt>
          <dd>{formatCurrency(extracted.marketValue) ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Tax Year</dt>
          <dd>{extracted.taxYear ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium">Appeal Deadline</dt>
          <dd>{extracted.appealDeadline ?? "Not found"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-500">
        Parsed via PDF.co (pages: {metadata.pdfco.pageCount ?? "—"}) and OpenAI model{" "}
        {metadata.openai.model}. Tokens used: {metadata.openai.totalTokens ?? "—"}.
      </p>
    </>
  );
}
