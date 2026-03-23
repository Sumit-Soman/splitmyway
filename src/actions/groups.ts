"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/server-user";
import { calculateBalances } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";
import { addMemberSchema, createGroupSchema } from "@/lib/validations/group";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        currency: parsed.data.currency,
      },
    });
    await tx.groupMember.create({
      data: {
        userId: user.id,
        groupId: g.id,
        role: "admin",
      },
    });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        groupId: g.id,
        type: ACTIVITY_TYPES.GROUP_CREATED,
        metadata: { groupName: g.name },
      },
    });
    return g;
  });

  revalidatePath("/groups");
  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}

export async function getGroupsForUser() {
  noStore();
  const user = await requireUser();
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    select: { groupId: true, role: true },
  });
  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId);
  const roleByGroupId = new Map(memberships.map((m) => [m.groupId, m.role]));

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: { select: { userId: true } },
      expenses: {
        include: { participants: true },
      },
      settlements: true,
      _count: { select: { members: true, expenses: true } },
    },
  });

  const orderIndex = new Map(groupIds.map((id, i) => [id, i]));
  groups.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

  return groups.map((g) => {
    const memberIds = g.members.map((m) => m.userId);
    const balancesMap = calculateBalances({
      memberIds,
      expenses: g.expenses.map((e) => ({
        paidById: e.paidById,
        participants: e.participants.map((p) => ({
          userId: p.userId,
          amount: toNumber(p.amount),
        })),
      })),
      settlements: g.settlements.map((s) => ({
        fromId: s.fromId,
        toId: s.toId,
        amount: toNumber(s.amount),
      })),
    });
    const raw = balancesMap[user.id] ?? 0;
    const yourBalance = Math.round(raw * 100) / 100;

    return {
      id: g.id,
      name: g.name,
      description: g.description,
      category: g.category,
      currency: g.currency,
      role: roleByGroupId.get(g.id) ?? "member",
      memberCount: g._count.members,
      expenseCount: g._count.expenses,
      yourBalance,
    };
  });
}

export type GroupListItem = Awaited<ReturnType<typeof getGroupsForUser>>[number];

export async function getGroupById(groupId: string) {
  const user = await requireUser();
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId } },
    include: {
      group: true,
    },
  });
  if (!membership) return null;
  return {
    ...membership.group,
    role: membership.role,
  };
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

  const admin = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: current.id, groupId: parsed.data.groupId } },
  });
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "Only admins can add members." };
  }

  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  if (target) {
    if (target.id === current.id) {
      return { success: false, error: "You are already in this group." };
    }
    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: target.id, groupId: parsed.data.groupId } },
    });
    if (existing) {
      return { success: false, error: "User is already a member." };
    }
    await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          userId: target.id,
          groupId: parsed.data.groupId,
          role: "member",
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: current.id,
          groupId: parsed.data.groupId,
          type: ACTIVITY_TYPES.MEMBER_ADDED,
          metadata: { email: target.email, name: target.name },
        },
      }),
    ]);
  } else {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    await prisma.invitation.create({
      data: {
        groupId: parsed.data.groupId,
        email: parsed.data.email.toLowerCase().trim(),
        invitedBy: current.id,
        expiresAt,
        status: "pending",
      },
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
  const admin = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: current.id, groupId } },
  });
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "Only admins can remove members." };
  }
  if (userId === current.id) {
    return { success: false, error: "Use leave group instead (not implemented)." };
  }

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member) {
    return { success: false, error: "Member not found." };
  }

  await prisma.$transaction([
    prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId } },
    }),
    prisma.activityLog.create({
      data: {
        userId: current.id,
        groupId,
        type: ACTIVITY_TYPES.MEMBER_REMOVED,
        metadata: { removedUserId: userId },
      },
    }),
  ]);

  revalidatePath(`/groups/${groupId}`);
  return { success: true };
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const current = await requireUser();
  const admin = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: current.id, groupId } },
  });
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "Only admins can delete the group." };
  }

  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath("/groups");
  revalidatePath("/dashboard");
  revalidatePath("/settlements");
  return { success: true };
}
