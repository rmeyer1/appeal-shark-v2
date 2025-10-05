import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { parseAssessmentDocument } from "@/lib/parsing/assessment-parser";
import prismaClient from "@/lib/prisma";
import { lookupZillowValuation, ZillowMissingCredentialsError } from "@/lib/zillow";
import type { ApiValuation, ParseRequestBody } from "@/types/assessment";
import type { Prisma } from "@prisma/client";

const DEFAULT_BUCKET = "user-documents";

function buildError(message: string, status: number) {
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
  const body = (await request.json().catch(() => ({}))) as ParseRequestBody;

  if (!body.path) {
    return buildError("storage path is required.", 400);
  }

  if (!body.documentGroupId || !isUuid(body.documentGroupId)) {
    return buildError("documentGroupId is required for parsing.", 400);
  }

  const bucket = body.bucket || DEFAULT_BUCKET;
  const expiresIn = body.expiresInSeconds ?? 60;

  const pdfcoKey = process.env.PDFCO_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!pdfcoKey) {
    return buildError("PDFCO_API_KEY environment variable is not configured.", 500);
  }

  if (!openaiKey) {
    return buildError("OPENAI_API_KEY environment variable is not configured.", 500);
  }

  try {
    const client = getSupabaseServiceRoleClient();
    const { data, error } = await client.storage.from(bucket).createSignedUrl(body.path, expiresIn);

    if (error || !data?.signedUrl) {
      const message = error?.message || "Unable to create signed URL for PDF.";
      return buildError(message, 500);
    }

    const result = await parseAssessmentDocument({
      signedUrl: data.signedUrl,
      pdfcoApiKey: pdfcoKey,
      openaiApiKey: openaiKey,
      openaiModel: body.openaiModel,
    });

    let valuationForResponse: ApiValuation | null = null;

    const propertyAddress = result.extracted?.propertyAddress;

    if (propertyAddress) {
      try {
        const valuation = await lookupZillowValuation(propertyAddress);

        if (valuation) {
          const amountValue = valuation.amount !== null ? Math.round(valuation.amount) : null;
          const currencyValue = valuation.currency ?? "USD";
          const valuationDate = valuation.valuationDate ?? null;
          const rawResponse = {
            searchHit: valuation.searchHit,
            propertyDetail: valuation.propertyDetail,
            analytics: valuation.analytics,
          } as Prisma.InputJsonValue;

          const analyticsForResponse = valuation.analytics
            ? {
                countyFips: valuation.analytics.countyFips,
                valuationRange: valuation.analytics.valuationRange,
                taxHistory: valuation.analytics.taxHistory,
                latest: valuation.analytics.latest,
                averageEffectiveTaxRate: valuation.analytics.averageEffectiveTaxRate,
                projectedTaxAtMarket: valuation.analytics.projectedTaxAtMarket,
                projectedSavingsVsLatest: valuation.analytics.projectedSavingsVsLatest,
                propertyFacts: valuation.analytics.propertyFacts,
                latestSale: valuation.analytics.latestSale,
              }
            : null;

          await prismaClient.propertyValuation.upsert({
            where: {
              documentGroupId_provider: {
                documentGroupId: body.documentGroupId,
                provider: "zillow",
              },
            },
            update: {
              providerId: valuation.zpid,
              amount: amountValue,
              currency: currencyValue,
              confidence: valuation.confidence,
              valuationDate,
              rawResponse,
              fetchedAt: new Date(),
            },
            create: {
              documentGroupId: body.documentGroupId,
              provider: "zillow",
              providerId: valuation.zpid,
              amount: amountValue,
              currency: currencyValue,
              confidence: valuation.confidence,
              valuationDate,
              rawResponse,
            },
          });

          valuationForResponse = {
            provider: "zillow",
            amount: amountValue,
            currency: currencyValue,
            zpid: valuation.zpid,
            confidence: valuation.confidence,
            valuationDate: valuationDate ? valuationDate.toISOString() : null,
            analytics: analyticsForResponse,
          };
        }
      } catch (error) {
        if (!(error instanceof ZillowMissingCredentialsError)) {
          // Swallow Zillow API failures while allowing assessment parsing to succeed.
        }
      }
    }

    const extractionRecord = await prismaClient.assessmentExtraction.upsert({
      where: { documentGroupId: body.documentGroupId },
      update: {
        payload: result.extracted,
        rawText: result.rawText,
        model: result.metadata.openai.model,
        pdfPageCount: result.metadata.pdfco.pageCount ?? undefined,
        pdfCredits: result.metadata.pdfco.credits ?? undefined,
        openaiInputTokens: result.metadata.openai.inputTokens ?? undefined,
        openaiOutputTokens: result.metadata.openai.outputTokens ?? undefined,
        openaiTotalTokens: result.metadata.openai.totalTokens ?? undefined,
      },
      create: {
        documentGroupId: body.documentGroupId,
        payload: result.extracted,
        rawText: result.rawText,
        model: result.metadata.openai.model,
        pdfPageCount: result.metadata.pdfco.pageCount ?? undefined,
        pdfCredits: result.metadata.pdfco.credits ?? undefined,
        openaiInputTokens: result.metadata.openai.inputTokens ?? undefined,
        openaiOutputTokens: result.metadata.openai.outputTokens ?? undefined,
        openaiTotalTokens: result.metadata.openai.totalTokens ?? undefined,
      },
    });

    return NextResponse.json(
      {
        extracted: result.extracted,
        metadata: result.metadata,
        rawText: result.rawText,
        assessmentExtractionId: extractionRecord.id,
        valuation: valuationForResponse,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error during parsing.";
    return buildError(message, 500);
  }
}
