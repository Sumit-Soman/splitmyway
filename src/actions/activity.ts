"use server";

import { getAuthUser } from "@/lib/auth/server-user";
import { getAdminPb } from "@/lib/pocketbase/admin";
import { listMembershipsForUser } from "@/lib/pocketbase/queries";
import { escapeFilterValue } from "@/lib/pocketbase/filter-escape";
import { recordField } from "@/lib/pocketbase/record-field";

/** PocketBase rows may omit or oddly format `created`; avoid Invalid Date. */
function createdMs(row: unknown): number {
  const r = row as { created?: string };
  const raw = recordField(row, "created") ?? r.created ?? "";
  const s = String(raw).trim();
  if (!s) return 0;
  let t = new Date(s).getTime();
  if (!Number.isNaN(t)) return t;
  t = new Date(s.replace(" ", "T")).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function createdIso(row: unknown): string {
  const ms = createdMs(row);
  return new Date(ms).toISOString();
}

export async function getRecentActivity(limit = 10) {
  const user = await getAuthUser();
  if (!user) return [];

  const memberships = await listMembershipsForUser(user.id);
  const groupIds = memberships.map((m) => m.groupId);

  const pb = await getAdminPb();
  const orUser = `user = "${escapeFilterValue(user.id)}"`;
  const orGroups =
    groupIds.length === 0
      ? ""
      : groupIds.length === 1
        ? `group = "${escapeFilterValue(groupIds[0]!)}"`
        : `(${groupIds.map((id) => `group = "${escapeFilterValue(id)}"`).join(" || ")})`;

  const filter =
    groupIds.length === 0 ? orUser : `(${orUser} || ${orGroups})`;

  // Avoid DB sort on `created` (see pb_migrations repair notes). Fetch matches, sort by time in memory.
  const logs = await pb.collection("activity_logs").getFullList({
    filter,
    expand: "user,group",
  });
  logs.sort((a, b) => createdMs(b) - createdMs(a));
  const top = logs.slice(0, limit);

  return top.map((l) => {
    const uRaw = l.expand?.user;
    const grpRaw = l.expand?.group;
    const meta = recordField(l, "metadata");
    return {
      id: l.id,
      type: String(recordField(l, "type") ?? ""),
      metadata:
        meta != null && typeof meta === "object" && !Array.isArray(meta)
          ? (meta as Record<string, unknown>)
          : null,
      createdAt: createdIso(l),
      user: {
        name: uRaw ? (recordField(uRaw, "name") as string | null) ?? null : null,
        email: uRaw ? String(recordField(uRaw, "email") ?? "") : "",
      },
      groupName: grpRaw ? (recordField(grpRaw, "name") as string | null) ?? null : null,
      groupId: (recordField(l, "group") as string | null) ?? null,
    };
  });
}
