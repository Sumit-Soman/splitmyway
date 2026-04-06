import { cache } from "react";
import PocketBase from "pocketbase";
import { createUserPbFromCookies, getPocketBaseUrl } from "@/lib/pocketbase/server";
import { getAppUserById } from "@/lib/pocketbase/queries";
import type { AppUser } from "@/lib/pocketbase/user-map";
import type { RecordModel } from "pocketbase";

/**
 * Single PocketBase auth validation per React server request (deduped via cache).
 */
export const getAuthUser = cache(async (): Promise<RecordModel | null> => {
  try {
    const pb = await createUserPbFromCookies();
    if (!pb.authStore.isValid) return null;
    try {
      await pb.collection("users").authRefresh();
    } catch {
      return null;
    }
    return pb.authStore.record;
  } catch {
    return null;
  }
});

export async function getDbUserById(userId: string): Promise<AppUser | null> {
  try {
    return await getAppUserById(userId);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<RecordModel> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** PocketBase instance with valid user auth (for file URLs). */
export async function getAuthenticatedPb(): Promise<PocketBase> {
  const pb = new PocketBase(getPocketBaseUrl());
  const mod = await import("next/headers");
  const store = await mod.cookies();
  const parts: string[] = [];
  for (const c of store.getAll()) {
    parts.push(`${c.name}=${encodeURIComponent(c.value)}`);
  }
  pb.authStore.loadFromCookie(parts.join("; "));
  if (!pb.authStore.isValid) {
    throw new Error("Unauthorized");
  }
  await pb.collection("users").authRefresh();
  return pb;
}
