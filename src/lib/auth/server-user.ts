import { cache } from "react";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/jwt-server";

export type AuthUser = {
  id: string;
  email: string;
};

/**
 * Single JWT validation per React server request (deduped via cache).
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get("smw_token")?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { id: session.sub, email: session.email };
});

export async function getDbUserById(userId: string) {
  const { getAppUserById } = await import("@/lib/pocketbase/queries");
  try {
    return await getAppUserById(userId);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
