import { workerFetchJson } from "@/lib/worker/client";
import { recordToAppUserFromApi } from "@/lib/worker/user-map";
import type { AppUser } from "@/lib/pocketbase/user-map";

/**
 * Load the signed-in user's profile from the Worker API.
 */
export async function ensureAppUserForAuth(user: { id: string }): Promise<AppUser> {
  void user;
  const { user: u } = await workerFetchJson<{ user: import("@/lib/worker/user-map").ApiUserPayload }>(`/v1/me`);
  return recordToAppUserFromApi(u);
}
