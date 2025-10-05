import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, createHash } from "crypto";
import {
  ensureUserDocumentsBucket,
  getStorageConfig,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase";
import prismaClient from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return buildErrorResponse("Content-Type must be multipart/form-data.", 415);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const rawUserId = formData.get("userId");

  if (!file || !(file instanceof File)) {
    return buildErrorResponse("Missing PDF file payload.", 400);
  }

  if (!rawUserId || typeof rawUserId !== "string" || !isUuid(rawUserId)) {
    return buildErrorResponse("Valid userId is required in form data.", 400);
  }

  if (file.type && !storageConfig.allowedMimeTypes.includes(file.type)) {
    return buildErrorResponse("Only PDF uploads are supported.", 415);
  }

  if (file.size > storageConfig.maxFileSizeBytes) {
    return buildErrorResponse("PDF exceeds 25MB limit.", 413);
  }

  const client = getSupabaseServiceRoleClient();

  await ensureUserDocumentsBucket(client);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const objectPath = `ingest/${new Date().getUTCFullYear()}/${randomUUID()}.pdf`;
  const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

  const { error: uploadError } = await client.storage
    .from(storageConfig.bucketName)
    .upload(objectPath, fileBuffer, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false,
      metadata: {
        originalName: file.name ?? "unknown.pdf",
        size: `${file.size}`,
      },
    });

  if (uploadError) {
    return buildErrorResponse(`Failed to persist PDF: ${uploadError.message}`, 500);
  }

  try {
    const { documentGroup, document } = await prismaClient.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.user.upsert({
          where: { id: rawUserId },
          create: { id: rawUserId },
          update: {},
        });

        const createdGroup = await tx.documentGroup.create({
          data: {
            userId: rawUserId,
            type: "UPLOAD",
          },
        });

        const createdDocument = await tx.document.create({
          data: {
            groupId: createdGroup.id,
            versionNumber: 1,
            storagePath: objectPath,
            fileHash,
            sizeBytes: BigInt(file.size),
            mimeType: "application/pdf",
            label: file.name || "Assessment",
            source: "UPLOADED",
          },
        });

        return { documentGroup: createdGroup, document: createdDocument };
      },
    );

    return NextResponse.json(
      {
        bucket: storageConfig.bucketName,
        path: objectPath,
        message: "Upload complete.",
        documentGroupId: documentGroup.id,
        documentId: document.id,
        userId: rawUserId,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register document metadata.";
    return buildErrorResponse(message, 500);
  }
}
