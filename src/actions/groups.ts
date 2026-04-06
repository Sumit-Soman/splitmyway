"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getAdminPb } from "@/lib/pocketbase/admin";
import { getAuthUser, requireUser } from "@/lib/auth/server-user";
import { calculateBalances } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";
import { sanitizeMemberSearchRaw } from "@/lib/member-search";
import { addMemberSchema, createGroupSchema } from "@/lib/validations/group";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { escapeFilterValue } from "@/lib/pocketbase/filter-escape";
import { recordField } from "@/lib/pocketbase/record-field";
import { listMembershipsForUser, findMembership } from "@/lib/pocketbase/queries";
import type { RecordModel } from "pocketbase";

export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    category: formData.get("category"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const auth = await getAdminPb();
  const g = await auth.collection("groups").create({
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    category: parsed.data.category,
    currency: parsed.data.currency,
  });

  await auth.collection("group_members").create({
    user: user.id,
    group: g.id,
    role: "admin",
    joined_at: new Date().toISOString(),
  });

  await auth.collection("activity_logs").create({
    user: user.id,
    group: g.id,
    type: ACTIVITY_TYPES.GROUP_CREATED,
    metadata: { groupName: parsed.data.name },
  });

  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect(`/groups/${g.id}?from=create`);
}

export async function getGroupsForUser() {
  noStore();
  const user = await requireUser();
  const memberships = await listMembershipsForUser(user.id);
  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId);
  const roleByGroupId = new Map(memberships.map((m) => [m.groupId, m.role]));
  const pb = await getAdminPb();

  const groupsPayload = [];
  for (const gid of groupIds) {
    const g = await pb.collection("groups").getOne(gid);
    const memRows = await pb.collection("group_members").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
    });
    const expRows = await pb.collection("expenses").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
    });
    const setRows = await pb.collection("settlements").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
    });

    const memberIds = memRows.map((m) => String(recordField(m, "user") ?? ""));
    const expensesData = [];
    for (const e of expRows) {
      const plist = await pb.collection("expense_participants").getFullList({
        filter: `expense = "${escapeFilterValue(e.id)}"`,
      });
      expensesData.push({
        paidById: String(recordField(e, "paid_by") ?? ""),
        participants: plist.map((p) => ({
          userId: String(recordField(p, "user") ?? ""),
          amount: toNumber(String(recordField(p, "amount") ?? "")),
        })),
      });
    }

    const balancesMap = calculateBalances({
      memberIds,
      expenses: expensesData.map((e) => ({
        paidById: e.paidById,
        participants: e.participants,
      })),
      settlements: setRows.map((s) => ({
        fromId: String(recordField(s, "from_user") ?? ""),
        toId: String(recordField(s, "to_user") ?? ""),
        amount: toNumber(String(recordField(s, "amount") ?? "")),
      })),
    });
    const raw = balancesMap[user.id] ?? 0;
    const yourBalance = Math.round(raw * 100) / 100;

    groupsPayload.push({
      id: g.id,
      name: String(recordField(g, "name") ?? ""),
      description: (recordField(g, "description") as string | null) ?? null,
      category: String(recordField(g, "category") ?? ""),
      currency: String(recordField(g, "currency") ?? ""),
      role: roleByGroupId.get(g.id) ?? "member",
      memberCount: memRows.length,
      expenseCount: expRows.length,
      yourBalance,
    });
  }

  return groupsPayload;
}

export type GroupListItem = Awaited<ReturnType<typeof getGroupsForUser>>[number];

export async function getGroupById(groupId: string) {
  const user = await requireUser();
  const membership = await findMembership(user.id, groupId);
  if (!membership) return null;
  const pb = await getAdminPb();
  const g = await pb.collection("groups").getOne(groupId);
  const createdRaw = String(recordField(g, "created") ?? "");
  const updatedRaw = String(recordField(g, "updated") ?? "");
  return {
    id: g.id,
    name: String(recordField(g, "name") ?? ""),
    description: (recordField(g, "description") as string | null) ?? null,
    category: String(recordField(g, "category") ?? ""),
    currency: String(recordField(g, "currency") ?? ""),
    createdAt: new Date(createdRaw || 0),
    updatedAt: new Date(updatedRaw || 0),
    role: String(recordField(membership, "role") ?? "member"),
  };
}

export type MemberSearchHit = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export async function searchGroupMemberCandidates(groupId: string, query: string): Promise<MemberSearchHit[]> {
  noStore();
  const user = await getAuthUser();
  if (!user) return [];

  const raw = sanitizeMemberSearchRaw(query);
  if (!raw) return [];

  const membership = await findMembership(user.id, groupId);
  if (!membership) return [];

  const pb = await getAdminPb();
  const memberRows = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
  });
  const memberIds = new Set(
    memberRows.map((m) => String(recordField(m, "user") ?? "")).filter(Boolean)
  );

  const safe = escapeFilterValue(raw.toLowerCase());
  const filter = `(email ~ "${safe}%" || name ~ "${safe}%") && id != "${escapeFilterValue(user.id)}"`;
  let candidates = await pb.collection("users").getFullList({
    filter,
    perPage: 50,
  });

  candidates = candidates.filter((c) => !memberIds.has(c.id)).slice(0, 12);

  return candidates.map((r) => {
    const av = recordField(r, "avatar");
    return {
      id: r.id,
      name: (recordField(r, "name") as string | null) ?? null,
      email: r.email,
      avatarUrl: av ? pb.files.getUrl(r as Record<string, unknown>, String(av)) : null,
    };
  });
}

export async function addMemberToGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const current = await requireUser();
  const parsed = addMemberSchema.safeParse({
    groupId: formData.get("groupId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adm = await findMembership(current.id, parsed.data.groupId);
  if (!adm) {
    return { success: false, error: "You are not a member of this group." };
  }

  const pb = await getAdminPb();
  const emailLower = parsed.data.email.toLowerCase().trim();
  const existing = await pb.collection("users").getFullList({
    filter: `email = "${escapeFilterValue(emailLower)}"`,
    limit: 1,
  });
  const target = existing[0] as RecordModel | undefined;

  if (target) {
    if (target.id === current.id) {
      return { success: false, error: "You are already in this group." };
    }
    const already = await findMembership(target.id, parsed.data.groupId);
    if (already) {
      return { success: false, error: "User is already a member." };
    }
    await pb.collection("group_members").create({
      user: target.id,
      group: parsed.data.groupId,
      role: "member",
      joined_at: new Date().toISOString(),
    });
    await pb.collection("activity_logs").create({
      user: current.id,
      group: parsed.data.groupId,
      type: ACTIVITY_TYPES.MEMBER_ADDED,
      metadata: { email: target.email, name: recordField(target, "name") },
    });
  } else {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    await pb.collection("invitations").create({
      group: parsed.data.groupId,
      email: emailLower,
      invited_by: current.id,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      token: crypto.randomUUID(),
    });
    revalidatePath(`/groups/${parsed.data.groupId}`);
    return {
      success: true,
      message:
        "No account for that email yet. An invitation was saved — they can join after signing up with the same email.",
    };
  }

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/groups");
  return { success: true, message: "Member added." };
}

export async function removeMemberFromGroup(groupId: string, userId: string): Promise<ActionResult> {
  const current = await requireUser();
  const admin = await findMembership(current.id, groupId);
  if (!admin || String(recordField(admin, "role") ?? "") !== "admin") {
    return { success: false, error: "Only admins can remove members." };
  }
  if (userId === current.id) {
    return { success: false, error: "Use leave group instead (not implemented)." };
  }

  const pb = await getAdminPb();
  const member = await pb.collection("group_members").getFullList({
    filter: `user = "${escapeFilterValue(userId)}" && group = "${escapeFilterValue(groupId)}"`,
    limit: 1,
  });
  const row = member[0];
  if (!row) {
    return { success: false, error: "Member not found." };
  }

  await pb.collection("group_members").delete(row.id);
  await pb.collection("activity_logs").create({
    user: current.id,
    group: groupId,
    type: ACTIVITY_TYPES.MEMBER_REMOVED,
    metadata: { removedUserId: userId },
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const current = await requireUser();
  const admin = await findMembership(current.id, groupId);
  if (!admin || String(recordField(admin, "role") ?? "") !== "admin") {
    return { success: false, error: "Only admins can delete the group." };
  }

  const pb = await getAdminPb();
  await pb.collection("groups").delete(groupId);
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  revalidatePath("/settlements");
  return { success: true };
}
