"use client";

import { useMemo, useState, useTransition } from "react";

import type { LetterSectionPayload } from "@/types/letters";

export type LetterVersion = {
  id: string;
  versionNumber: number;
  createdAt: string;
  label: string | null;
  signedUrl: string | null;
};

type GenerationState = "idle" | "loading" | "error";

export default function LetterGenerationPanel({
  documentGroupId,
  existingLetters,
}: {
  documentGroupId: string;
  existingLetters: LetterVersion[];
}) {
  const [state, setState] = useState<GenerationState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [letters, setLetters] = useState<LetterVersion[]>(existingLetters);
  const [latestPreview, setLatestPreview] = useState<LetterSectionPayload | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLoading = state === "loading" || isPending;

  const handleGenerate = () => {
    setState("loading");
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/letters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documentGroupId }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          signedUrl?: string | null;
          version?: number;
          documentId?: string;
          sections?: LetterSectionPayload;
        };

        if (!response.ok) {
          const message = payload.error ?? "Unable to generate letter.";
          throw new Error(message);
        }

        if (payload.documentId && payload.version) {
          const documentId = payload.documentId;
          const version = payload.version;
          const signedUrl = payload.signedUrl ?? null;
          setLetters(prev => [
            {
              id: documentId,
              versionNumber: version,
              createdAt: new Date().toISOString(),
              label: `Appeal Letter v${version}`,
              signedUrl,
            },
            ...prev,
          ]);
        }

        if (payload.sections) {
          setLatestPreview(payload.sections);
        }

        setState("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate letter.";
        setErrorMessage(message);
        setState("error");
      }
    });
  };

  const orderedLetters = useMemo(
    () => [...letters].sort((a, b) => b.versionNumber - a.versionNumber),
    [letters],
  );

  const hasLetters = orderedLetters.length > 0;

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm dark:border-emerald-400/60 dark:bg-emerald-900/30">
      <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Generate your appeal letter</h2>
      <p className="mt-3 text-sm text-emerald-900/80 dark:text-emerald-100/80">
        Draft a county-ready appeal letter that cites your assessment data, valuation analytics, and filing checklist. Every run keeps a new version for your records.
      </p>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Generating…" : hasLetters ? "Generate new version" : "Create first letter"}
      </button>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-900/30 dark:text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {latestPreview ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-white p-4 text-sm text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-950 dark:text-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-200">
            Latest preview
          </p>
          <p className="mt-2 whitespace-pre-line text-sm">{latestPreview.body.join("\n\n")}</p>
          <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-200">
            Download the PDF for the final formatted letter and filing checklist.
          </p>
        </div>
      ) : null}

      {hasLetters ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Letter history</h3>
          <ul className="mt-3 space-y-3 text-sm text-emerald-900 dark:text-emerald-100">
            {orderedLetters.map(letter => {
              const createdDate = new Date(letter.createdAt);
              const formatted = Number.isNaN(createdDate.valueOf())
                ? null
                : createdDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
              return (
                <li
                  key={letter.id}
                  className="flex flex-col rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-400/60 dark:bg-emerald-950 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {letter.label ?? `Appeal Letter v${letter.versionNumber}`}
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                      Generated {formatted ?? "just now"}
                    </p>
                  </div>
                  {letter.signedUrl ? (
                    <a
                      href={letter.signedUrl}
                      className="mt-3 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 md:mt-0"
                    >
                      Download PDF
                    </a>
                  ) : (
                    <span className="mt-3 text-xs text-emerald-700/70 dark:text-emerald-200/70 md:mt-0">
                      Download unavailable
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
