import prismaClient from "@/lib/prisma";
import type { ProfileCacheEntry } from "@/types/jurisdiction";

const CACHE_TTL_MS = 5 * 60 * 1000; // five minutes
const ratioCache = new Map<string, ProfileCacheEntry>();

async function fetchAssessmentRatio(countyFips: string): Promise<number | null> {
  const rows = await prismaClient.$queryRaw<
    Array<{ default_assessment_ratio: number | null }>
  >`SELECT default_assessment_ratio FROM jurisdiction_tax_profile WHERE fips = ${countyFips} LIMIT 1`;

  const [row] = rows;
  return row?.default_assessment_ratio ?? null;
}

export async function getAssessmentRatioForCounty(
  countyFips: string | null | undefined,
): Promise<number | null> {
  if (!countyFips) {
    return null;
  }

  const normalized = countyFips.trim();
  if (!normalized) {
    return null;
  }

  const cached = ratioCache.get(normalized);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.ratio;
  }

  const ratio = await fetchAssessmentRatio(normalized);
  ratioCache.set(normalized, {
    ratio,
    expiresAt: now + CACHE_TTL_MS,
  });

  return ratio;
}

export function clearAssessmentRatioCache() {
  ratioCache.clear();
}
