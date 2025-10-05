import Link from "next/link";
import { notFound } from "next/navigation";
import AssessmentSummaryDetails from "@/components/file-upload/assessment-summary-details";
import PropertyInsights from "@/components/file-upload/property-insights";
import ValuationSummary from "@/components/file-upload/valuation-summary";
import ThemeToggle from "@/components/theme-toggle";
import prismaClient from "@/lib/prisma";
import type { DerivedValuation, ParsingResponse } from "@/types/assessment";
import type { ZillowValuationAnalytics } from "@/types/zillow";

function isUuid(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ documentGroupId: string }>;
}) {
  const { documentGroupId } = await params;

  if (!isUuid(documentGroupId)) {
    notFound();
  }

  const documentGroup = await prismaClient.documentGroup.findUnique({
    where: { id: documentGroupId },
    include: {
      extraction: true,
      valuations: true,
      documents: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!documentGroup) {
    notFound();
  }

  const extraction = documentGroup.extraction;
  const extractedPayload = (extraction?.payload ?? null) as ParsingResponse["extracted"] | null;

  const zillowRecord =
    documentGroup.valuations.find(valuation => valuation.provider === "zillow") ?? null;

  let zillowAnalytics: ZillowValuationAnalytics | null = null;
  if (
    zillowRecord &&
    isRecord(zillowRecord.rawResponse) &&
    isRecord(zillowRecord.rawResponse.analytics)
  ) {
    zillowAnalytics = zillowRecord.rawResponse.analytics as ZillowValuationAnalytics;
  }

  const assessedValue = extractedPayload?.assessedValue ?? null;
  const fallbackMarketValue = extractedPayload?.marketValue ?? null;
  const zillowAmount = zillowRecord?.amount ?? null;
  const marketValue = zillowAmount !== null ? zillowAmount : fallbackMarketValue;
  const marketSource =
    zillowAmount !== null
      ? "Zillow Zestimate"
      : fallbackMarketValue !== null
        ? "Assessment document market value"
        : null;
  const savings =
    assessedValue !== null && marketValue !== null ? Math.round(assessedValue - marketValue) : null;

  const derivedValuation: DerivedValuation | null = extractedPayload
    ? {
        assessedValue,
        marketValue,
        marketSource,
        savings,
        zillow: zillowRecord
          ? {
              provider: zillowRecord.provider,
              amount: zillowAmount,
              currency: zillowRecord.currency ?? null,
              zpid: zillowRecord.providerId ?? null,
              confidence: zillowRecord.confidence ?? null,
              valuationDate: zillowRecord.valuationDate
                ? zillowRecord.valuationDate.toISOString()
                : null,
              analytics: zillowAnalytics,
            }
          : null,
        analytics: zillowAnalytics,
      }
    : null;

  const parsingResponse: ParsingResponse | null = extractedPayload
    ? {
        extracted: extractedPayload,
        metadata: {
          pdfco: {
            pageCount: extraction?.pdfPageCount ?? null,
            credits: extraction?.pdfCredits ?? null,
          },
          openai: {
            model: extraction?.model ?? "openai-gpt",
            inputTokens: extraction?.openaiInputTokens ?? null,
            outputTokens: extraction?.openaiOutputTokens ?? null,
            totalTokens: extraction?.openaiTotalTokens ?? null,
          },
        },
        rawText: extraction?.rawText ?? "",
        assessmentExtractionId: extraction?.id ?? documentGroupId,
        valuation: derivedValuation?.zillow ?? null,
      }
    : null;

  const uploadedDocument = documentGroup.documents[0] ?? null;
  const uploadedAt = uploadedDocument?.createdAt ?? null;
  const parsedAt = extraction?.createdAt ?? null;
  const uploadSizeMb = uploadedDocument
    ? Math.round((Number(uploadedDocument.sizeBytes) / (1024 * 1024)) * 100) / 100
    : null;
  const uploadSizeLabel =
    uploadSizeMb !== null
      ? `${uploadSizeMb.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MB`
      : "—";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Appeal workspace
            </span>
            <h1 className="mt-3 text-4xl font-bold text-slate-900 dark:text-slate-100 md:text-5xl">
              Assessment dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
              Review the data we extracted from your assessment, compare market valuations, and
              prepare next steps for your appeal. We’ll keep this space updated as new documents and
              analyses are generated.
            </p>
            <dl className="mt-6 grid gap-4 text-xs text-slate-500 md:grid-cols-2">
              {uploadedAt ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <dt className="font-semibold text-slate-600 dark:text-slate-200">Uploaded</dt>
                  <dd className="text-slate-700 dark:text-slate-100">
                    {formatDateTime(uploadedAt) ?? "—"}
                  </dd>
                </div>
              ) : null}
              {parsedAt ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <dt className="font-semibold text-slate-600 dark:text-slate-200">
                    Insights generated
                  </dt>
                  <dd className="text-slate-700 dark:text-slate-100">
                    {formatDateTime(parsedAt) ?? "—"}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="flex items-start justify-end gap-3">
            <ThemeToggle />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Assessment summary
                </h2>
                {uploadedDocument ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {uploadedDocument.label ?? "Assessment"}
                  </span>
                ) : null}
              </div>
              {parsingResponse ? (
                <div className="mt-4">
                  <AssessmentSummaryDetails assessment={parsingResponse} />
                </div>
              ) : (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                  We’re still parsing the assessment details. Refresh this page in a moment if
                  nothing appears.
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Tax impact overview
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                We model how your annual tax bill could shift if the assessment aligns with Zillow’s
                market view.
              </p>
              <ValuationSummary valuation={derivedValuation} />
              <PropertyInsights valuation={derivedValuation} />
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm dark:border-emerald-400/60 dark:bg-emerald-900/30">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                Generate your appeal letter
              </h2>
              <p className="mt-3 text-sm text-emerald-900/80 dark:text-emerald-100/80">
                We’re wiring up GPT-powered letter creation next. Soon you’ll be able to craft,
                review, and download your county-ready appeal directly from this dashboard.
              </p>
              <button
                type="button"
                disabled
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white opacity-80"
              >
                Coming soon
              </button>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                County filing checklist
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                We’ll surface the exact forms, portals, and deadlines for your county here. For now,
                keep an eye on your assessment notice for official instructions.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600"
                    aria-hidden
                  />
                  <span>Download the assessment notice PDF and confirm the appeal deadline.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600"
                    aria-hidden
                  />
                  <span>
                    Compile any comparable sales or neighborhood data that supports your case.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600"
                    aria-hidden
                  />
                  <span>
                    Check county portal or mail-in requirements. We’ll automate this in the next
                    milestone.
                  </span>
                </li>
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Document activity
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <dt>Document ID</dt>
                  <dd className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {documentGroupId.slice(0, 12)}…
                  </dd>
                </div>
                {uploadedDocument ? (
                  <div className="flex items-center justify-between">
                    <dt>Original upload size</dt>
                    <dd>{uploadSizeLabel}</dd>
                  </div>
                ) : null}
                {uploadedDocument ? (
                  <div className="flex items-center justify-between">
                    <dt>Stored path</dt>
                    <dd className="max-w-[12rem] truncate text-xs text-slate-500 dark:text-slate-400">
                      {uploadedDocument.storagePath}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <Link
                href="/"
                className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Upload another assessment
              </Link>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
