import type { ParsingResponse } from "@/types/assessment";
import { formatCurrency } from "@/components/file-upload/formatters";

type AssessmentSummaryDetailsProps = {
  assessment: ParsingResponse;
};

export default function AssessmentSummaryDetails({ assessment }: AssessmentSummaryDetailsProps) {
  const { extracted, metadata } = assessment;

  return (
    <>
      <dl className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-200">
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Parcel ID</dt>
          <dd className="text-slate-700 dark:text-slate-100">{extracted.parcelId ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Owner</dt>
          <dd className="text-slate-700 dark:text-slate-100">{extracted.ownerName ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Address</dt>
          <dd
            className="max-w-[12rem] truncate text-slate-700 dark:text-slate-100"
            title={extracted.propertyAddress ?? "Not found"}
          >
            {extracted.propertyAddress ?? "Not found"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Assessed Value</dt>
          <dd className="text-slate-700 dark:text-slate-100">
            {formatCurrency(extracted.assessedValue) ?? "Not found"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Market Value</dt>
          <dd className="text-slate-700 dark:text-slate-100">
            {formatCurrency(extracted.marketValue) ?? "Not found"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Tax Year</dt>
          <dd className="text-slate-700 dark:text-slate-100">{extracted.taxYear ?? "Not found"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-medium text-slate-700 dark:text-slate-100">Appeal Deadline</dt>
          <dd className="text-slate-700 dark:text-slate-100">{extracted.appealDeadline ?? "Not found"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-300">
        Parsed via PDF.co (pages: {metadata.pdfco.pageCount ?? "—"}) and OpenAI model{" "}
        {metadata.openai.model}. Tokens used: {metadata.openai.totalTokens ?? "—"}.
      </p>
    </>
  );
}
