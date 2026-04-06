import path from "node:path";
import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";

loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, ".env.local") });

/** Removes groups created by E2E so the next run starts clean. */
export default async function globalTeardown(): Promise<void> {
  const url = process.env.POCKETBASE_URL;
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!url || !email || !password) return;

  const pb = new PocketBase(url);
  await pb.admins.authWithPassword(email, password);

  const groups = await pb.collection("groups").getFullList({
    filter: 'name ~ "E2E-AUT-"',
  });
  for (const g of groups) {
    await pb.collection("groups").delete(g.id);
  }
  // eslint-disable-next-line no-console
  console.log(`[e2e teardown] Deleted ${groups.length} group(s) matching E2E-AUT-*`);
}
