import Link from "next/link";
import { notFound } from "next/navigation";
import AssessmentSummaryDetails from "@/components/file-upload/assessment-summary-details";
import ComparableSales from "@/components/dashboard/comparable-sales";
import TaxInsightsCarousel from "@/components/dashboard/tax-insights-carousel";
import LetterGenerationPanel, { type LetterVersion } from "@/components/dashboard/letter-generation-panel";
import ThemeToggle from "@/components/theme-toggle";
import prismaClient from "@/lib/prisma";
import { getSupabaseServiceRoleClient, getStorageConfig } from "@/lib/supabase";
import type { DerivedValuation, ParsingResponse } from "@/types/assessment";
import type { ZillowValuationAnalytics } from "@/types/zillow";
import type { ComparableSale } from "@/types/dashboard";

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

function extractComparableSales(raw: unknown): { sales: ComparableSale[]; lastUpdatedIso: string | null } {
  if (!isRecord(raw)) {
    return { sales: [], lastUpdatedIso: null };
  }

  const detail = isRecord(raw.propertyDetail) ? (raw.propertyDetail as Record<string, unknown>) : null;

  if (!detail || !Array.isArray(detail.nearbyHomes)) {
    return { sales: [], lastUpdatedIso: null };
  }

  const nearbyHomes = detail.nearbyHomes as unknown[];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const datedSales: Array<{ sale: ComparableSale; soldDate: Date }> = [];
  const undatedSales: ComparableSale[] = [];

  let fallbackCounter = 0;

  for (const entry of nearbyHomes) {
    if (!isRecord(entry)) {
      continue;
    }

    const statusRaw = entry.homeStatus;
    const status = typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() : "";
    if (status !== "SOLD") {
      continue;
    }

    fallbackCounter += 1;

    const sale: ComparableSale = {
      id: inferId(entry, fallbackCounter),
      address: inferAddress(entry),
      price: toNumber(entry.price),
      squareFeet: toNumber(entry.livingAreaValue ?? entry.livingArea),
      bedrooms: toNumber(entry.bedrooms),
      bathrooms: toNumber(entry.bathrooms ?? entry.bathroomsFloat),
      soldDate: null,
    };

    const rawSoldDate = extractSoldDate(entry);
    const soldDate = rawSoldDate ? parseDate(rawSoldDate) : null;

    if (soldDate && soldDate >= sixMonthsAgo) {
      sale.soldDate = soldDate.toISOString();
      datedSales.push({ sale, soldDate });
    } else if (soldDate) {
      // Older than six months; ignore.
      continue;
    } else {
      undatedSales.push(sale);
    }
  }

  datedSales.sort((a, b) => b.soldDate.getTime() - a.soldDate.getTime());

  const sales: ComparableSale[] = datedSales.map(entry => entry.sale);

  if (sales.length < 3) {
    sales.push(...undatedSales.slice(0, 3 - sales.length));
  }

  const mostRecent = datedSales[0]?.soldDate ?? null;

  return {
    sales: sales.slice(0, 3),
    lastUpdatedIso: mostRecent ? mostRecent.toISOString() : null,
  };
}

function inferId(record: Record<string, unknown>, fallbackIndex: number): string {
  const zpid = record.zpid;
  if (typeof zpid === "string" && zpid.trim().length > 0) {
    return zpid;
  }
  if (typeof zpid === "number") {
    return String(zpid);
  }
  return `comp-${fallbackIndex}`;
}

function inferAddress(record: Record<string, unknown>): string {
  const address = record.address;
  if (isRecord(address)) {
    const street = typeof address.streetAddress === "string" ? address.streetAddress.trim() : "";
    const city = typeof address.city === "string" ? address.city.trim() : "";
    const state = typeof address.state === "string" ? address.state.trim() : "";
    const zipcode = typeof address.zipcode === "string" ? address.zipcode.trim() : "";
    const parts = [street, city, state, zipcode].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  const formattedChip = record.formattedChip;
  if (isRecord(formattedChip) && Array.isArray(formattedChip.location)) {
    const location = formattedChip.location
      .map(entry => (isRecord(entry) && typeof entry.fullValue === "string" ? entry.fullValue.trim() : ""))
      .filter(Boolean);
    if (location.length > 0) {
      return location.join(", ");
    }
  }

  const url = typeof record.hdpUrl === "string" ? record.hdpUrl : null;
  if (url) {
    return url;
  }

  return "Comparable sale";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractSoldDate(record: Record<string, unknown>): unknown {
  const candidates = [
    record.dateSold,
    record.soldDate,
    record.lastSoldDate,
    record.soldTime,
    record.lastSoldTime,
    record.saleDate,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value > 1e12 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    const fallback = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
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
      children: {
        where: { type: "GENERATED" },
        include: {
          documents: {
            orderBy: { versionNumber: "desc" },
          },
        },
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

  const { sales: comparableSales, lastUpdatedIso: comparableLastUpdatedIso } = extractComparableSales(
    zillowRecord?.rawResponse ?? null,
  );

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

  const storageConfig = getStorageConfig();
  const supabase = getSupabaseServiceRoleClient();

  const letterGroup = documentGroup.children.at(0) ?? null;
  let letterVersions: LetterVersion[] = [];

  if (letterGroup) {
    const signedUrls = await Promise.all(
      letterGroup.documents.map(async document => {
        const { data, error } = await supabase.storage
          .from(storageConfig.bucketName)
          .createSignedUrl(document.storagePath, 60 * 10);
        if (error) {
          return { id: document.id, url: null } as const;
        }
        return { id: document.id, url: data?.signedUrl ?? null } as const;
      }),
    );

    letterVersions = letterGroup.documents.map(document => {
      const signed = signedUrls.find(entry => entry.id === document.id);
      return {
        id: document.id,
        versionNumber: document.versionNumber,
        createdAt: document.createdAt.toISOString(),
        label: document.label,
        signedUrl: signed?.url ?? null,
      } satisfies LetterVersion;
    });
  }

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
              <TaxInsightsCarousel valuation={derivedValuation} />
            </section>

            <ComparableSales sales={comparableSales} lastUpdatedIso={comparableLastUpdatedIso} />
          </div>

          <div className="space-y-6">
            <LetterGenerationPanel
              documentGroupId={documentGroupId}
              existingLetters={letterVersions}
            />

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
