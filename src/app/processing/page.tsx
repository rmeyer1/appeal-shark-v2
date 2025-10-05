import Link from "next/link";
import ProcessingClient from "@/app/processing/processing-client";

type ProcessingSearchParams = {
  documentGroupId?: string;
  path?: string;
  bucket?: string;
};

export default async function ProcessingPage({
  searchParams,
}: {
  searchParams: Promise<ProcessingSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const documentGroupId = resolvedParams.documentGroupId ?? "";
  const path = resolvedParams.path ?? "";
  const bucket = resolvedParams.bucket ?? "user-documents";

  const isMissingParams = !documentGroupId || !path;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-foreground">
      {isMissingParams ? (
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-semibold text-slate-900">Missing processing details</h1>
          <p className="mt-4 text-sm text-slate-600">
            We couldn&apos;t determine which document to process. Please return to the homepage and upload your assessment
            again.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
          >
            Go back to upload
          </Link>
        </section>
      ) : (
        <ProcessingClient documentGroupId={documentGroupId} path={path} bucket={bucket} />
      )}
    </main>
  );
}
