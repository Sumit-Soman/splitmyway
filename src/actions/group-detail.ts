"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getAuthUser } from "@/lib/auth/server-user";
import { getGroupDetailSerialized as buildGroupDetail } from "@/lib/pocketbase/queries";

export async function getGroupDetailSerialized(groupId: string) {
  noStore();
  const user = await getAuthUser();
  if (!user) return null;
  return buildGroupDetail(groupId, user.id);
}

export type GroupDetailSerialized = NonNullable<Awaited<ReturnType<typeof getGroupDetailSerialized>>>;
