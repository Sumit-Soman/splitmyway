"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { settlementSchema } from "@/lib/validations/expense";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createSettlement(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settlementSchema.safeParse({
    groupId: formData.get("groupId"),
    fromId: formData.get("fromId"),
    toId: formData.get("toId"),
    amount: formData.get("amount"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    include: { members: true },
  });
  if (!group) {
    return { success: false, error: "Group not found." };
  }

  const ids = new Set(group.members.map((m) => m.userId));
  if (!ids.has(user.id)) {
    return { success: false, error: "Not a member." };
  }
  if (!ids.has(parsed.data.fromId) || !ids.has(parsed.data.toId)) {
    return { success: false, error: "Both parties must be group members." };
  }
  if (parsed.data.fromId === parsed.data.toId) {
    return { success: false, error: "Cannot settle with yourself." };
  }

  await prisma.$transaction([
    prisma.settlement.create({
      data: {
        groupId: parsed.data.groupId,
        fromId: parsed.data.fromId,
        toId: parsed.data.toId,
        amount: new Decimal(parsed.data.amount.toFixed(2)),
        currency: group.currency,
        notes: parsed.data.notes,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: user.id,
        groupId: parsed.data.groupId,
        type: ACTIVITY_TYPES.SETTLEMENT_RECORDED,
        metadata: {
          fromId: parsed.data.fromId,
          toId: parsed.data.toId,
          amount: parsed.data.amount,
        },
      },
    }),
  ]);

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getSettlementsForUser() {
  const user = await requireUser();
  const groups = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = groups.map((g) => g.groupId);
  if (groupIds.length === 0) return [];

  const rows = await prisma.settlement.findMany({
    where: { groupId: { in: groupIds } },
    include: {
      group: { select: { id: true, name: true, currency: true } },
      from: { select: { id: true, name: true, email: true } },
      to: { select: { id: true, name: true, email: true } },
    },
    orderBy: { settledAt: "desc" },
  });

  return rows.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    groupName: s.group.name,
    currency: s.currency,
    amount: Number(s.amount),
    notes: s.notes,
    settledAt: s.settledAt.toISOString(),
    from: s.from,
    to: s.to,
    youPaid: s.fromId === user.id,
    youReceived: s.toId === user.id,
  }));
}
