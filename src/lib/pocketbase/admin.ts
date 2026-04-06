import PocketBase from "pocketbase";
import { normalizePocketBaseUrl } from "./url";

const globalForPb = globalThis as { adminPb?: PocketBase };

/**
 * Server-only admin client (bypasses collection API rules). Use only after verifying the
 * authenticated user is allowed to perform the operation.
 */
export async function getAdminPb(): Promise<PocketBase> {
  const url = normalizePocketBaseUrl(process.env.POCKETBASE_URL);
  if (!url) {
    throw new Error("Missing POCKETBASE_URL");
  }
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD");
  }

  if (!globalForPb.adminPb) {
    const pb = new PocketBase(url);
    // Singleton + concurrent Next.js RSC/actions would otherwise autocancel each other's requests.
    pb.autoCancellation(false);
    globalForPb.adminPb = pb;
  }
  const pb = globalForPb.adminPb;
  if (!pb.authStore.isValid) {
    await pb.admins.authWithPassword(email, password);
  }
  return pb;
}
