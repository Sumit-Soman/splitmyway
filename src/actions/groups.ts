"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { addMemberSchema, createGroupSchema } from "@/lib/validations/group";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

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
  return { success: true, data: { id: group.id } };
}

export async function getGroupsForUser() {
  const user = await requireUser();
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true, expenses: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    description: m.group.description,
    category: m.group.category,
    currency: m.group.currency,
    role: m.role,
    memberCount: m.group._count.members,
    expenseCount: m.group._count.expenses,
  }));
}

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
  return { success: true };
}
