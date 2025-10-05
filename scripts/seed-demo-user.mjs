import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function ensureDemoUser() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = requireEnv("DATABASE_URL");
  const demoUserId = requireEnv("NEXT_PUBLIC_DEMO_USER_ID");
  const demoUserEmail = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL ?? "demo@appealshark.test";
  const demoUserPassword = process.env.DEMO_USER_PASSWORD ?? "DemoUserPass123!";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const { data: lookupData, error: lookupError } =
      await supabase.auth.admin.getUserById(demoUserId);

    if (lookupError && lookupError.status !== 404) {
      throw lookupError;
    }

    let user = lookupData?.user ?? null;

    if (!user) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        id: demoUserId,
        email: demoUserEmail,
        password: demoUserPassword,
        email_confirm: true,
      });

      if (createError) {
        throw createError;
      }

      user = created.user;
      console.log(`Created Supabase Auth user ${user.id} (${user.email}).`);
    } else {
      console.log(`Supabase Auth user ${user.id} already exists.`);
    }

    await prisma.user.upsert({
      where: { id: demoUserId },
      create: {
        id: demoUserId,
        email: user?.email ?? demoUserEmail,
      },
      update: {
        email: user?.email ?? demoUserEmail,
      },
    });

    console.log(`Ensured Prisma User ${demoUserId} mirror exists.`);
  } finally {
    await prisma.$disconnect();
  }
}

ensureDemoUser().catch(error => {
  console.error("Failed to seed demo user:", error.message ?? error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
