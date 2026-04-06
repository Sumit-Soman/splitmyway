import PocketBase from "pocketbase";
import { cookies } from "next/headers";
import { normalizePocketBaseUrl } from "./url";

export function getPocketBaseUrl(): string {
  const base = normalizePocketBaseUrl(process.env.POCKETBASE_URL);
  if (!base) {
    throw new Error("Missing POCKETBASE_URL");
  }
  return base;
}

/**
 * PocketBase client with auth loaded from Next.js cookies (pb_auth).
 */
export async function createUserPbFromCookies(): Promise<PocketBase> {
  const pb = new PocketBase(getPocketBaseUrl());
  const store = await cookies();
  const parts: string[] = [];
  for (const c of store.getAll()) {
    parts.push(`${c.name}=${encodeURIComponent(c.value)}`);
  }
  pb.authStore.loadFromCookie(parts.join("; "));
  return pb;
}
