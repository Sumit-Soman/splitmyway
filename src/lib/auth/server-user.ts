import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Single Supabase Auth validation per React server request (deduped via cache).
 * Avoids N sequential getUser() round-trips when multiple loaders run in parallel.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/** Load app user row (not cached — avoids stale null after first-time user creation in layout). */
export async function getDbUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser() {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
