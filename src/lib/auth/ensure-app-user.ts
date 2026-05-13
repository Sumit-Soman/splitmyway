import { workerFetchJson } from "@/lib/worker/client";
import { recordToAppUserFromApi } from "@/lib/worker/user-map";
import type { AppUser } from "@/lib/pocketbase/user-map";

/**
 * Load the signed-in user's profile from the Worker API.
 * @param sessionToken Pass the token from login/signup in the same request — `cookies().set` is not visible to `cookies().get` until the next request.
 */
export async function ensureAppUserForAuth(
  user: { id: string },
  sessionToken?: string
): Promise<AppUser> {
  void user;
  const init =
    sessionToken !== undefined
      ? { headers: { Authorization: `Bearer ${sessionToken}` } }
      : undefined;
  const { user: u } = await workerFetchJson<{ user: import("@/lib/worker/user-map").ApiUserPayload }>(
    `/v1/me`,
    init
  );
  return recordToAppUserFromApi(u);
}
