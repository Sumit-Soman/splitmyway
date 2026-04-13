"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getAuthUser, requireUser } from "@/lib/auth/server-user";
import { sanitizeMemberSearchRaw } from "@/lib/member-search";
import { addMemberSchema, createGroupSchema } from "@/lib/validations/group";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findMembership } from "@/lib/pocketbase/queries";
import { WorkerApiError, workerFetchJson } from "@/lib/worker/client";

export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();
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

  const { groupId } = await workerFetchJson<{ groupId: string }>(`/v1/groups`, {
    method: "POST",
    json: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      currency: parsed.data.currency,
    },
  });

  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect(`/groups/${groupId}?from=create`);
}

export async function getGroupsForUser() {
  noStore();
  await requireUser();
  const { groups } = await workerFetchJson<{
    groups: Array<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      currency: string;
      role: string;
      memberCount: number;
      expenseCount: number;
      yourBalance: number;
    }>;
  }>(`/v1/groups`);
  return groups;
}

export type GroupListItem = Awaited<ReturnType<typeof getGroupsForUser>>[number];

export async function getGroupById(groupId: string) {
  const user = await requireUser();
  const membership = await findMembership(user.id, groupId);
  if (!membership) return null;
  try {
    const { group } = await workerFetchJson<{
      group: {
        id: string;
        name: string;
        description: string | null;
        category: string;
        currency: string;
        createdAt: string;
        updatedAt: string;
        role: string;
      };
    }>(`/v1/groups/${encodeURIComponent(groupId)}`);
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      currency: group.currency,
      createdAt: new Date(group.createdAt),
      updatedAt: new Date(group.updatedAt),
      role: group.role,
    };
  } catch {
    return null;
  }
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

  try {
    const { hits } = await workerFetchJson<{ hits: MemberSearchHit[] }>(
      `/v1/groups/${encodeURIComponent(groupId)}/member-search?q=${encodeURIComponent(raw)}`
    );
    return hits;
  } catch (e) {
    if (e instanceof WorkerApiError && e.status === 403) return [];
    throw e;
  }
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

  const res = await workerFetchJson<{ ok: boolean; invited: boolean }>(
    `/v1/groups/${encodeURIComponent(parsed.data.groupId)}/members`,
    {
      method: "POST",
      json: { email: parsed.data.email.toLowerCase().trim() },
    }
  );

  if (res.invited) {
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
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "Only admins can remove members." };
  }
  if (userId === current.id) {
    return { success: false, error: "Use leave group instead (not implemented)." };
  }

  await workerFetchJson(`/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const current = await requireUser();
  const admin = await findMembership(current.id, groupId);
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "Only admins can delete the group." };
  }

  await workerFetchJson(`/v1/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });

  revalidatePath("/groups");
  revalidatePath("/dashboard");
  revalidatePath("/settlements");
  return { success: true };
}
