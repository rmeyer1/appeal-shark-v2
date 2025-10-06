import { createHash } from "crypto";

import { NextResponse, type NextRequest } from "next/server";

import { buildLetterContext } from "@/lib/letters/context";
import { generateAppealLetter } from "@/lib/letters/generator";
import { renderAppealLetterPdf } from "@/lib/letters/pdf";
import { resolveCountyMetadata } from "@/lib/letters/metadata";
import type { LetterSectionPayload } from "@/lib/letters/types";
import prismaClient from "@/lib/prisma";
import {
  ensureUserDocumentsBucket,
  getStorageConfig,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase";
import type { ApiValuation } from "@/types/assessment";
import type { AssessmentExtraction } from "@/types/openai";
import type { ZillowValuationAnalytics } from "@/types/zillow";

const storageConfig = getStorageConfig();

function buildErrorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

function coerceAssessmentPayload(payload: unknown): AssessmentExtraction {
  if (!payload || typeof payload !== "object") {
    throw new Error("Assessment extraction payload is unavailable. Re-run document parsing first.");
  }
  const candidate = payload as AssessmentExtraction;
  const requiredKeys: (keyof AssessmentExtraction)[] = [
    "parcelId",
    "ownerName",
    "propertyAddress",
    "assessedValue",
    "marketValue",
    "taxYear",
    "assessmentDate",
    "appealDeadline",
    "notes",
  ];

  for (const key of requiredKeys) {
    if (!(key in candidate)) {
      throw new Error("Assessment extraction payload is missing expected fields. Re-run parsing.");
    }
  }

  return candidate;
}

function mapValuation(record: {
  provider: string;
  providerId: string | null;
  amount: number | null;
  currency: string | null;
  valuationDate: Date | null;
  confidence: string | null;
  rawResponse: unknown;
} | null): ApiValuation | null {
  if (!record) {
    return null;
  }

  let analytics: ZillowValuationAnalytics | null = null;
  if (record.rawResponse && typeof record.rawResponse === "object") {
    const raw = record.rawResponse as Record<string, unknown>;
    if (raw.analytics && typeof raw.analytics === "object") {
      analytics = raw.analytics as ZillowValuationAnalytics;
    }
  }

  return {
    provider: record.provider,
    amount: record.amount,
    currency: record.currency,
    zpid: record.providerId,
    confidence: record.confidence,
    valuationDate: record.valuationDate ? record.valuationDate.toISOString() : null,
    analytics,
  };
}

async function uploadLetterPdf({
  pdfBuffer,
  storagePath,
}: {
  pdfBuffer: Buffer;
  storagePath: string;
}): Promise<void> {
  const client = getSupabaseServiceRoleClient();
  await ensureUserDocumentsBucket(client);

  const { error } = await client.storage.from(storageConfig.bucketName).upload(storagePath, pdfBuffer, {
    contentType: "application/pdf",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload generated letter: ${error.message}`);
  }
}

async function createDocumentRecord({
  groupId,
  storagePath,
  buffer,
  versionNumber,
  label,
}: {
  groupId: string;
  storagePath: string;
  buffer: Buffer;
  versionNumber: number;
  label: string;
}) {
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  return prismaClient.$transaction(async tx => {
    await tx.document.updateMany({
      where: { groupId },
      data: { isActive: false },
    });

    return tx.document.create({
      data: {
        groupId,
        versionNumber,
        storagePath,
        fileHash,
        sizeBytes: BigInt(buffer.byteLength),
        mimeType: "application/pdf",
        label,
        source: "GENERATED",
        isActive: true,
      },
    });
  });
}

async function ensureLetterGroup(parentGroupId: string, userId: string) {
  const existing = await prismaClient.documentGroup.findFirst({
    where: { parentGroupId, type: "GENERATED" },
  });

  if (existing) {
    return existing;
  }

  return prismaClient.documentGroup.create({
    data: {
      userId,
      type: "GENERATED",
      parentGroupId,
    },
  });
}

export async function POST(request: NextRequest) {
  let body: { documentGroupId?: string; openaiModel?: string };
  try {
    body = (await request.json()) as { documentGroupId?: string; openaiModel?: string };
  } catch {
    return buildErrorResponse("Request body must be valid JSON.", 400);
  }

  const documentGroupId = body.documentGroupId;
  if (!documentGroupId || typeof documentGroupId !== "string" || !isUuid(documentGroupId)) {
    return buildErrorResponse("documentGroupId is required and must be a UUID.", 400);
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return buildErrorResponse("OPENAI_API_KEY environment variable is not configured.", 500);
  }

  const uploadGroup = await prismaClient.documentGroup.findUnique({
    where: { id: documentGroupId },
    include: {
      extraction: true,
      valuations: true,
    },
  });

  if (!uploadGroup || uploadGroup.type !== "UPLOAD") {
    return buildErrorResponse("Upload document group not found.", 404);
  }

  if (!uploadGroup.extraction) {
    return buildErrorResponse("Assessment data is missing. Parse the assessment before generating a letter.", 409);
  }

  let assessment: AssessmentExtraction;
  try {
    assessment = coerceAssessmentPayload(uploadGroup.extraction.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment data unavailable.";
    return buildErrorResponse(message, 409);
  }

  const valuationRecord = uploadGroup.valuations.find(valuation => valuation.provider === "zillow") ?? null;
  const apiValuation = mapValuation(valuationRecord ?? null);
  const countyMetadata = await resolveCountyMetadata(apiValuation?.analytics ?? null, assessment);

  const context = buildLetterContext({
    assessment,
    valuation: apiValuation,
    countyMetadata,
  });

  let letterResult: { sections: LetterSectionPayload; usage: { model: string; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } };
  try {
    letterResult = await generateAppealLetter({
      context,
      apiKey: openaiApiKey,
      model: body.openaiModel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI letter generation failed.";
    return buildErrorResponse(message, 502);
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderAppealLetterPdf(letterResult.sections);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to render letter PDF.";
    return buildErrorResponse(message, 500);
  }

  const lettersGroup = await ensureLetterGroup(uploadGroup.id, uploadGroup.userId);
  const latestDocument = await prismaClient.document.findFirst({
    where: { groupId: lettersGroup.id },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersion = (latestDocument?.versionNumber ?? 0) + 1;
  const storagePath = `${uploadGroup.userId}/${lettersGroup.id}/v${nextVersion}/appeal-letter-v${nextVersion}.pdf`;

  try {
    await uploadLetterPdf({
      pdfBuffer,
      storagePath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload generated letter.";
    return buildErrorResponse(message, 500);
  }

  let document;
  try {
    document = await createDocumentRecord({
      groupId: lettersGroup.id,
      storagePath,
      buffer: pdfBuffer,
      versionNumber: nextVersion,
      label: `Appeal Letter v${nextVersion}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to persist letter metadata.";
    return buildErrorResponse(message, 500);
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: signed, error: signedError } = await supabase.storage
    .from(storageConfig.bucketName)
    .createSignedUrl(storagePath, 60 * 10);

  if (signedError) {
    return buildErrorResponse(`Generated letter but failed to create download URL: ${signedError.message}`, 500);
  }

  return NextResponse.json(
    {
      bucket: storageConfig.bucketName,
      documentGroupId: lettersGroup.id,
      parentDocumentGroupId: uploadGroup.id,
      documentId: document.id,
      path: storagePath,
      version: document.versionNumber,
      signedUrl: signed?.signedUrl ?? null,
      usage: letterResult.usage,
      sections: letterResult.sections,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
