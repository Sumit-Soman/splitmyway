import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, ".env.local") });

async function ensureSupabaseUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- service-role client vs default generic
  admin: any,
  prisma: PrismaClient,
  email: string,
  password: string,
  name: string
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;

  let uid = list?.users?.find((u: { email?: string | null }) => u.email?.toLowerCase() === normalized)?.id;

  if (!uid) {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    uid = data.user?.id ?? undefined;
  }

  if (!uid) {
    throw new Error(`[e2e setup] Could not resolve auth user id for ${email}`);
  }

  await prisma.user.upsert({
    where: { id: uid },
    create: { id: uid, email: normalized, name, currency: "USD" },
    update: { email: normalized, name },
  });

  // eslint-disable-next-line no-console
  console.log(`[e2e setup] Ready: ${normalized} → ${uid}`);
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    // eslint-disable-next-line no-console
    console.warn(
      "[e2e setup] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing — create users manually in Supabase + sign in once, or set env and re-run."
    );
    return;
  }

  const prisma = new PrismaClient();
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const a = process.env.E2E_USER_A_EMAIL ?? "testuser@test.com";
  const b = process.env.E2E_USER_B_EMAIL ?? "cooanju@gmail.com";
  const pwA = process.env.E2E_USER_A_PASSWORD ?? "Test@123";
  const pwB = process.env.E2E_USER_B_PASSWORD ?? "Test@123";

  try {
    await ensureSupabaseUser(admin, prisma, a, pwA, "Test User");
    await ensureSupabaseUser(admin, prisma, b, pwB, "Anju");
  } finally {
    await prisma.$disconnect();
  }
}
