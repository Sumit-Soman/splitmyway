"use server";

import { getAdminPb } from "@/lib/pocketbase/admin";
import { requireUser } from "@/lib/auth/server-user";
import { settlementSchema } from "@/lib/validations/expense";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import Decimal from "decimal.js";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { escapeFilterValue } from "@/lib/pocketbase/filter-escape";
import { recordField } from "@/lib/pocketbase/record-field";
import { listMembershipsForUser } from "@/lib/pocketbase/queries";

export async function createSettlement(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const rawAmount = formData.get("amount");
  const parsed = settlementSchema.safeParse({
    groupId: formData.get("groupId"),
    fromId: formData.get("fromId"),
    toId: formData.get("toId"),
    amount: typeof rawAmount === "string" ? rawAmount.trim() : rawAmount,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsg = Object.entries(flat.fieldErrors)
      .flatMap(([k, msgs]) => msgs.map((m) => `${k}: ${m}`))
      .join(" · ");
    return {
      success: false,
      error: fieldMsg || "Validation failed",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const pb = await getAdminPb();
  const group = await pb.collection("groups").getOne(parsed.data.groupId);
  const memRows = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(parsed.data.groupId)}"`,
  });
  const ids = new Set(memRows.map((m) => String(recordField(m, "user") ?? "")).filter(Boolean));

  if (!ids.has(user.id)) {
    return { success: false, error: "Not a member." };
  }
  if (!ids.has(parsed.data.fromId) || !ids.has(parsed.data.toId)) {
    return { success: false, error: "Both parties must be group members." };
  }
  if (parsed.data.fromId === parsed.data.toId) {
    return { success: false, error: "Cannot settle with yourself." };
  }

  const amountStr = new Decimal(parsed.data.amount.toFixed(2)).toFixed(2);
  await pb.collection("settlements").create({
    group: parsed.data.groupId,
    from_user: parsed.data.fromId,
    to_user: parsed.data.toId,
    amount: amountStr,
    currency: String(recordField(group, "currency") ?? ""),
    notes: parsed.data.notes ?? "",
    settled_at: new Date().toISOString(),
  });

  await pb.collection("activity_logs").create({
    user: user.id,
    group: parsed.data.groupId,
    type: ACTIVITY_TYPES.SETTLEMENT_RECORDED,
    metadata: {
      fromId: parsed.data.fromId,
      toId: parsed.data.toId,
      amount: parsed.data.amount,
    },
  });

  const gid = parsed.data.groupId;
  revalidatePath(`/groups/${gid}`);
  revalidatePath("/groups");
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true };
}

export async function getSettlementsForUser() {
  noStore();
  const user = await requireUser();
  const memberships = await listMembershipsForUser(user.id);
  const groupIds = memberships.map((g) => g.groupId);
  if (groupIds.length === 0) return [];

  const pb = await getAdminPb();
  const filter =
    groupIds.length === 1
      ? `group = "${escapeFilterValue(groupIds[0]!)}"`
      : `(${groupIds.map((id) => `group = "${escapeFilterValue(id)}"`).join(" || ")})`;

  const rows = await pb.collection("settlements").getFullList({
    filter,
    sort: "-settled_at",
    expand: "group,from_user,to_user",
  });

  return rows.map((s) => {
    const g = s.expand?.group as Record<string, unknown> | undefined;
    const from = s.expand?.from_user as Record<string, unknown> | undefined;
    const to = s.expand?.to_user as Record<string, unknown> | undefined;
    const settledRaw = String(recordField(s, "settled_at") ?? "");
    const settledAt = Number.isNaN(new Date(settledRaw).getTime())
      ? new Date(0).toISOString()
      : new Date(settledRaw).toISOString();
    return {
      id: s.id,
      groupId: String(recordField(s, "group") ?? ""),
      groupName: String(recordField(g, "name") ?? ""),
      currency: String(recordField(s, "currency") ?? ""),
      amount: Number(recordField(s, "amount") ?? 0),
      notes: (recordField(s, "notes") as string | null) ?? null,
      settledAt,
      from: {
        id: String(recordField(from, "id") ?? ""),
        name: (recordField(from, "name") as string | null) ?? null,
        email: String(recordField(from, "email") ?? ""),
      },
      to: {
        id: String(recordField(to, "id") ?? ""),
        name: (recordField(to, "name") as string | null) ?? null,
        email: String(recordField(to, "email") ?? ""),
      },
      youPaid: String(recordField(s, "from_user") ?? "") === user.id,
      youReceived: String(recordField(s, "to_user") ?? "") === user.id,
    };
  });
}
