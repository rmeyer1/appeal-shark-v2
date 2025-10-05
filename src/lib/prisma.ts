import { PrismaClient } from "@prisma/client";

type PrismaGlobal = { prisma?: PrismaClient };

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function resolveDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error(
      "Missing DATABASE_URL (or DATABASE_POOL_URL) environment variable. Set it to your pooled Supabase connection string.",
    );
  }

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("supabase")) {
      if (!url.searchParams.has("sslmode")) {
        url.searchParams.set("sslmode", "require");
      }

      if (hostname.includes("pooler.supabase") && !url.searchParams.has("pgbouncer")) {
        url.searchParams.set("pgbouncer", "true");
        if (!url.searchParams.has("connection_limit")) {
          url.searchParams.set("connection_limit", "1");
        }
        if (!url.searchParams.has("pool_timeout")) {
          url.searchParams.set("pool_timeout", "30");
        }
      }

      return url.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

const databaseUrl = resolveDatabaseUrl();

export const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: { db: { url: databaseUrl } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient;
}

export default prismaClient;
