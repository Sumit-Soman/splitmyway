import path from "node:path";
import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";

loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, ".env.local") });

async function ensurePbUser(
  pb: PocketBase,
  email: string,
  password: string,
  name: string
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const rows = await pb.collection("users").getFullList({
    filter: `email = "${normalized.replace(/"/g, '\\"')}"`,
    limit: 1,
  });
  if (rows[0]) {
    await pb.collection("users").update(rows[0].id, { name, currency: "USD" });
    // eslint-disable-next-line no-console
    console.log(`[e2e setup] Existing user: ${normalized}`);
    return;
  }
  await pb.collection("users").create({
    email: normalized,
    password,
    passwordConfirm: password,
    name,
    currency: "USD",
  });
  // eslint-disable-next-line no-console
  console.log(`[e2e setup] Created: ${normalized}`);
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.POCKETBASE_URL;
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;

  if (!url || !email || !password) {
    // eslint-disable-next-line no-console
    console.warn(
      "[e2e setup] POCKETBASE_URL / POCKETBASE_ADMIN_* missing — create E2E users manually in PocketBase, or set env."
    );
    return;
  }

  const pb = new PocketBase(url);
  await pb.admins.authWithPassword(email, password);

  const a = process.env.E2E_USER_A_EMAIL ?? "testuser@test.com";
  const b = process.env.E2E_USER_B_EMAIL ?? "cooanju@gmail.com";
  const pwA = process.env.E2E_USER_A_PASSWORD ?? "Test@123";
  const pwB = process.env.E2E_USER_B_PASSWORD ?? "Test@123";

  await ensurePbUser(pb, a, pwA, "Test User");
  await ensurePbUser(pb, b, pwB, "Anju");
}
