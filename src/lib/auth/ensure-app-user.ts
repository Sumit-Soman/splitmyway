import type { RecordModel } from "pocketbase";
import { createUserPbFromCookies } from "@/lib/pocketbase/server";
import { recordToAppUser } from "@/lib/pocketbase/user-map";
import type { AppUser } from "@/lib/pocketbase/user-map";

/**
 * Map PocketBase auth record to app profile (single users collection).
 * `user` may be a POJO when restored from the auth cookie (no `.get()`).
 */
export async function ensureAppUserForAuth(user: RecordModel | Record<string, unknown>): Promise<AppUser> {
  const pb = await createUserPbFromCookies();
  return recordToAppUser(pb, user);
}
