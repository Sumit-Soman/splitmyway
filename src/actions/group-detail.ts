"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getAuthUser } from "@/lib/auth/server-user";
import { getGroupDetailSerialized as buildGroupDetail } from "@/lib/pocketbase/queries";
import { WorkerApiError } from "@/lib/worker/client";

export async function getGroupDetailSerialized(groupId: string) {
  noStore();
  const user = await getAuthUser();
  if (!user) return null;
  try {
    return await buildGroupDetail(groupId, user.id);
  } catch (e) {
    if (e instanceof WorkerApiError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

export type GroupDetailSerialized = NonNullable<Awaited<ReturnType<typeof getGroupDetailSerialized>>>;
