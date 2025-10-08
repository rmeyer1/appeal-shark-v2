import prismaClient from "@/lib/prisma";

type ProfileCacheEntry = {
  ratio: number | null;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // five minutes
const ratioCache = new Map<string, ProfileCacheEntry>();

async function fetchAssessmentRatio(countyFips: string): Promise<number | null> {
  const record = await prismaClient.jurisdictionTaxProfile.findUnique({
    where: { fips: countyFips },
    select: { defaultAssessmentRatio: true },
  });

  return record?.defaultAssessmentRatio ?? null;
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
