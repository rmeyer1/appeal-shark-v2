"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMaxFileSizeInMb, getStorageConfig } from "@/lib/storage-config";
import type { UploadResponse, UploadState } from "@/types/assessment";

const storageConfig = getStorageConfig();
const maxFileSizeMb = getMaxFileSizeInMb();

export default function FileUpload() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const resetMessages = () => {
    setStatusMessage(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    resetMessages();

    if (!file) {
      setSelectedFile(null);
      setUploadState("idle");
      return;
    }

    if (!storageConfig.allowedMimeTypes.includes(file.type)) {
      setSelectedFile(null);
      setUploadState("error");
      setStatusMessage("Only PDF files are supported.");
      event.target.value = "";
      return;
    }

    if (file.size > storageConfig.maxFileSizeBytes) {
      setSelectedFile(null);
      setUploadState("error");
      setStatusMessage(`PDF must be ${maxFileSizeMb} MB or smaller.`);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadState("idle");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setUploadState("error");
      setStatusMessage("Select a PDF before uploading.");
      return;
    }

    const userId = process.env.NEXT_PUBLIC_DEMO_USER_ID;

    if (!userId) {
      setUploadState("error");
      setStatusMessage("Missing NEXT_PUBLIC_DEMO_USER_ID environment variable.");
      return;
    }

    resetMessages();
    setUploadState("uploading");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("userId", userId);

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as UploadResponse | { error?: string };

      if (!response.ok) {
        const errorMessage = "error" in payload && payload.error ? payload.error : "Upload failed.";
        throw new Error(errorMessage);
      }

      const uploadPayload = payload as UploadResponse;
      setUploadState("success");
      setStatusMessage("Upload complete. Preparing your assessment insights...");

      const params = new URLSearchParams({
        documentGroupId: uploadPayload.documentGroupId,
        path: uploadPayload.path,
      });

      if (uploadPayload.bucket) {
        params.set("bucket", uploadPayload.bucket);
      }

      router.push(`/processing?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setUploadState("error");
      setStatusMessage(message);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadState("idle");
    resetMessages();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="Assessment PDF uploader"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="assessment-pdf" className="text-left text-sm font-semibold text-slate-700">
          Upload property tax assessment (PDF)
        </label>
        <input
          id="assessment-pdf"
          name="assessment-pdf"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full cursor-pointer rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 hover:border-slate-400"
        />
        <p className="text-xs text-slate-500">
          Max size {maxFileSizeMb} MB. Stored privately in Supabase Storage with encryption at rest.
        </p>
        {selectedFile ? (
          <p className="text-sm text-slate-600" data-testid="selected-file">
            Selected file: {selectedFile.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={uploadState === "uploading"}
        >
          {uploadState === "uploading" ? "Uploading..." : "Upload PDF"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          Clear
        </button>
      </div>

      {statusMessage ? (
        <p
          role={uploadState === "error" ? "alert" : "status"}
          className={
            uploadState === "error"
              ? "text-sm font-medium text-red-600"
              : "text-sm font-medium text-emerald-600"
          }
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </form>
  );
}
