"use server";

import { getAuthUser } from "@/lib/auth/server-user";
import { workerFetchJson } from "@/lib/worker/client";

function createdMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function getRecentActivity(limit = 10) {
  const user = await getAuthUser();
  if (!user) return [];

  const { logs } = await workerFetchJson<{
    logs: Array<{
      id: string;
      type: string;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      user: { name: string | null; email: string };
      groupName: string | null;
      groupId: string | null;
    }>;
  }>(`/v1/activity?limit=${encodeURIComponent(String(limit))}`);

  const sorted = [...logs].sort((a, b) => createdMs(b.createdAt) - createdMs(a.createdAt));
  const top = sorted.slice(0, limit);

  return top.map((l) => ({
    id: l.id,
    type: l.type,
    metadata: l.metadata,
    createdAt: new Date(l.createdAt).toISOString(),
    user: {
      name: l.user.name,
      email: l.user.email,
    },
    groupName: l.groupName,
    groupId: l.groupId,
  }));
}
