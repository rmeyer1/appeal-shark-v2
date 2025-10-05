"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProcessingClientProps = {
  documentGroupId: string;
  path: string;
  bucket: string;
};

type ProcessingState = "idle" | "requesting" | "parsing" | "completed" | "error";

type ProcessingStep = {
  key: ProcessingState;
  label: string;
  description: string;
};

const processingSteps: ProcessingStep[] = [
  {
    key: "requesting",
    label: "Uploading complete",
    description: "We stored your assessment securely in Supabase Storage.",
  },
  {
    key: "parsing",
    label: "Analyzing assessment & market data",
    description: "Extracting parcel details, fetching Zillow valuation, and calculating insights.",
  },
  {
    key: "completed",
    label: "Preparing your dashboard",
    description: "Finalizing your personalized appeal workspace.",
  },
];

export default function ProcessingClient({ documentGroupId, path, bucket }: ProcessingClientProps) {
  const router = useRouter();
  const [state, setState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const runParsing = async () => {
      setState("requesting");

      try {
        const response = await fetch("/api/parsing/assessment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path,
            documentGroupId,
            bucket,
          }),
        });

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ error: "Parsing failed." }))) as {
            error?: string;
          };
          const message = payload.error ?? "Parsing failed.";
          throw new Error(message);
        }

        setState("parsing");

        await response.json().catch(() => null);

        // Brief pause to let the UI show progress before navigation.
        setTimeout(() => {
          if (isCancelled) {
            return;
          }

          setState("completed");

          setTimeout(() => {
            if (!isCancelled) {
              router.replace(`/dashboard/${documentGroupId}`);
            }
          }, 700);
        }, 400);
      } catch (error) {
        if (!isCancelled) {
          const message =
            error instanceof Error ? error.message : "Unable to process your assessment.";
          setErrorMessage(message);
          setState("error");
        }
      }
    };

    runParsing();

    return () => {
      isCancelled = true;
    };
  }, [bucket, documentGroupId, path, router]);

  const activeKeys = useMemo(() => {
    switch (state) {
      case "requesting":
        return new Set<ProcessingState>(["requesting"]);
      case "parsing":
        return new Set<ProcessingState>(["requesting", "parsing"]);
      case "completed":
        return new Set<ProcessingState>(["requesting", "parsing", "completed"]);
      default:
        return new Set<ProcessingState>();
    }
  }, [state]);

  return (
    <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white px-10 py-12 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Appeal Shark
          </span>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">
            Processing your assessment
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Hang tight for a moment while we transform your upload into actionable appeal insights.
          </p>
        </div>
        <div className="hidden h-16 w-16 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 md:flex">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
        </div>
      </div>

      <ol className="mt-10 space-y-4">
        {processingSteps.map(step => {
          const isActive = activeKeys.has(step.key);
          const isCompleted = state === "completed";
          return (
            <li
              key={step.key}
              className={`flex items-start gap-4 rounded-2xl border p-5 transition ${
                isActive
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/60 dark:bg-emerald-900/30"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <span
                className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                }`}
                aria-hidden
              >
                {isCompleted || isActive ? "✓" : processingSteps.indexOf(step) + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {step.label}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {state === "error" && errorMessage ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-2">{errorMessage}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition hover:opacity-90"
          >
            Return to upload
          </button>
        </div>
      ) : null}

      <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-400">
        Need help? Email support@appealshark.com and we’ll keep you posted on the progress.
      </p>
    </section>
  );
}
