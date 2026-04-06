"use server";

import { getAdminPb } from "@/lib/pocketbase/admin";
import { requireUser } from "@/lib/auth/server-user";
import { getRate } from "@/lib/exchange-rates";
import { calculateSplit } from "@/lib/calculations/splits";
import { createExpenseSchema, updateExpenseSchema } from "@/lib/validations/expense";
import { ACTIVITY_TYPES, MAX_EXPENSE_ATTACHMENT_BYTES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { removeExpenseAndClearSettlementsIfLedgerEmpty } from "@/lib/ledger/expense-deletion";
import { escapeFilterValue } from "@/lib/pocketbase/filter-escape";
import { recordField } from "@/lib/pocketbase/record-field";

export async function createExpense(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();

  const participantIds = formData.getAll("participantIds").map(String).filter(Boolean);
  const exactRaw = formData.get("exactAmounts");
  const pctRaw = formData.get("percentages");
  const sharesRaw = formData.get("shares");

  let exactAmounts: Record<string, number> | undefined;
  let percentages: Record<string, number> | undefined;
  let shares: Record<string, number> | undefined;

  try {
    if (exactRaw) exactAmounts = JSON.parse(String(exactRaw)) as Record<string, number>;
    if (pctRaw) percentages = JSON.parse(String(pctRaw)) as Record<string, number>;
    if (sharesRaw) shares = JSON.parse(String(sharesRaw)) as Record<string, number>;
  } catch {
    return { success: false, error: "Invalid split payload." };
  }

  const parsed = createExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    category: formData.get("category"),
    date: formData.get("date"),
    paidById: formData.get("paidById"),
    notes: formData.get("notes") || null,
    splitMethod: formData.get("splitMethod"),
    participantIds,
    exactAmounts,
    percentages,
    shares,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const pb = await getAdminPb();
  const group = await pb.collection("groups").getOne(parsed.data.groupId);
  const memRows = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(parsed.data.groupId)}"`,
  });
  const memberIdsSet = new Set(
    memRows.map((m) => String(recordField(m, "user") ?? "")).filter(Boolean)
  );

  if (!memberIdsSet.has(user.id)) {
    return { success: false, error: "Not a member of this group." };
  }

  for (const pid of parsed.data.participantIds) {
    if (!memberIdsSet.has(pid)) {
      return { success: false, error: "All participants must be group members." };
    }
  }

  const inputAmount = parsed.data.amount;
  const expenseCurrency = parsed.data.currency.toUpperCase();
  const groupCurrency = String(recordField(group, "currency") ?? "").toUpperCase();

  let convertedAmount = inputAmount;
  let originalAmount: string | null = null;
  let originalCurrency: string | null = null;
  let exchangeRate: string | null = null;

  if (expenseCurrency !== groupCurrency) {
    const rate = await getRate(expenseCurrency, groupCurrency);
    convertedAmount = Math.round(inputAmount * rate * 100) / 100;
    originalAmount = new Decimal(inputAmount.toFixed(2)).toFixed(2);
    originalCurrency = expenseCurrency;
    exchangeRate = new Decimal(rate.toFixed(8)).toFixed(8);
  }

  const split = calculateSplit({
    method: parsed.data.splitMethod,
    totalAmount: convertedAmount,
    participantIds: parsed.data.participantIds,
    exactAmounts: parsed.data.exactAmounts,
    percentages: parsed.data.percentages,
    shares: parsed.data.shares,
  });

  if (!split.ok) {
    return { success: false, error: split.error };
  }

  const recordFields = {
    group: parsed.data.groupId,
    paid_by: parsed.data.paidById,
    description: parsed.data.description,
    amount: new Decimal(convertedAmount.toFixed(2)).toFixed(2),
    currency: groupCurrency,
    original_amount: originalAmount ?? "",
    original_currency: originalCurrency ?? "",
    exchange_rate: exchangeRate ?? "",
    category: parsed.data.category,
    date: parsed.data.date.toISOString(),
    notes: parsed.data.notes ?? "",
    split_method: parsed.data.splitMethod,
  };

  const att = formData.get("attachment");
  let expense: { id: string };
  if (att instanceof File && att.size > 0) {
    if (att.size > MAX_EXPENSE_ATTACHMENT_BYTES) {
      return { success: false, error: "Attachment must be 15 MB or smaller." };
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(recordFields)) {
      fd.append(k, v);
    }
    fd.append("attachment", att);
    expense = await pb.collection("expenses").create(fd);
  } else {
    expense = await pb.collection("expenses").create(recordFields);
  }

  for (const [uid, amt] of Object.entries(split.amounts)) {
    const shareVal =
      parsed.data.splitMethod === "shares" && parsed.data.shares?.[uid]
        ? Math.floor(parsed.data.shares[uid])
        : null;
    const pctVal =
      parsed.data.splitMethod === "percentage" && parsed.data.percentages?.[uid] !== undefined
        ? new Decimal(parsed.data.percentages[uid]!.toFixed(2)).toFixed(2)
        : "";
    await pb.collection("expense_participants").create({
      expense: expense.id,
      user: uid,
      amount: new Decimal(amt.toFixed(2)).toFixed(2),
      shares: shareVal ?? undefined,
      percentage: pctVal || "",
    });
  }

  await pb.collection("activity_logs").create({
    user: user.id,
    group: parsed.data.groupId,
    type: ACTIVITY_TYPES.EXPENSE_ADDED,
    metadata: {
      expenseId: expense.id,
      description: parsed.data.description,
      amount: convertedAmount,
      currency: groupCurrency,
    },
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateExpense(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();

  const participantIds = formData.getAll("participantIds").map(String).filter(Boolean);
  const exactRaw = formData.get("exactAmounts");
  const pctRaw = formData.get("percentages");
  const sharesRaw = formData.get("shares");

  let exactAmounts: Record<string, number> | undefined;
  let percentages: Record<string, number> | undefined;
  let shares: Record<string, number> | undefined;

  try {
    if (exactRaw) exactAmounts = JSON.parse(String(exactRaw)) as Record<string, number>;
    if (pctRaw) percentages = JSON.parse(String(pctRaw)) as Record<string, number>;
    if (sharesRaw) shares = JSON.parse(String(sharesRaw)) as Record<string, number>;
  } catch {
    return { success: false, error: "Invalid split payload." };
  }

  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    groupId: formData.get("groupId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    category: formData.get("category"),
    date: formData.get("date"),
    paidById: formData.get("paidById"),
    notes: formData.get("notes") || null,
    splitMethod: formData.get("splitMethod"),
    participantIds,
    exactAmounts,
    percentages,
    shares,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const pb = await getAdminPb();
  const existing = await pb.collection("expenses").getOne(parsed.data.expenseId, {
    expand: "group",
  });
  if (String(recordField(existing, "group") ?? "") !== parsed.data.groupId) {
    return { success: false, error: "Expense does not belong to this group." };
  }

  const group = await pb.collection("groups").getOne(parsed.data.groupId);
  const memRows = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(parsed.data.groupId)}"`,
  });
  const memberIdsSet = new Set(
    memRows.map((m) => String(recordField(m, "user") ?? "")).filter(Boolean)
  );

  if (!memberIdsSet.has(user.id)) {
    return { success: false, error: "Not a member of this group." };
  }

  for (const pid of parsed.data.participantIds) {
    if (!memberIdsSet.has(pid)) {
      return { success: false, error: "All participants must be group members." };
    }
  }

  const inputAmount = parsed.data.amount;
  const expenseCurrency = parsed.data.currency.toUpperCase();
  const groupCurrency = String(recordField(group, "currency") ?? "").toUpperCase();

  let convertedAmount = inputAmount;
  let originalAmount: string | null = null;
  let originalCurrency: string | null = null;
  let exchangeRate: string | null = null;

  if (expenseCurrency !== groupCurrency) {
    const rate = await getRate(expenseCurrency, groupCurrency);
    convertedAmount = Math.round(inputAmount * rate * 100) / 100;
    originalAmount = new Decimal(inputAmount.toFixed(2)).toFixed(2);
    originalCurrency = expenseCurrency;
    exchangeRate = new Decimal(rate.toFixed(8)).toFixed(8);
  }

  const split = calculateSplit({
    method: parsed.data.splitMethod,
    totalAmount: convertedAmount,
    participantIds: parsed.data.participantIds,
    exactAmounts: parsed.data.exactAmounts,
    percentages: parsed.data.percentages,
    shares: parsed.data.shares,
  });

  if (!split.ok) {
    return { success: false, error: split.error };
  }

  const parts = await pb.collection("expense_participants").getFullList({
    filter: `expense = "${escapeFilterValue(parsed.data.expenseId)}"`,
  });
  for (const p of parts) {
    await pb.collection("expense_participants").delete(p.id);
  }

  const updateFields = {
    paid_by: parsed.data.paidById,
    description: parsed.data.description,
    amount: new Decimal(convertedAmount.toFixed(2)).toFixed(2),
    currency: groupCurrency,
    original_amount: originalAmount ?? "",
    original_currency: originalCurrency ?? "",
    exchange_rate: exchangeRate ?? "",
    category: parsed.data.category,
    date: parsed.data.date.toISOString(),
    notes: parsed.data.notes ?? "",
    split_method: parsed.data.splitMethod,
  };

  const newAtt = formData.get("attachment");
  const removeAttachment = formData.get("removeAttachment") === "1";

  if (newAtt instanceof File && newAtt.size > 0) {
    if (newAtt.size > MAX_EXPENSE_ATTACHMENT_BYTES) {
      return { success: false, error: "Attachment must be 15 MB or smaller." };
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(updateFields)) {
      fd.append(k, v);
    }
    fd.append("attachment", newAtt);
    await pb.collection("expenses").update(parsed.data.expenseId, fd);
  } else if (removeAttachment) {
    await pb.collection("expenses").update(parsed.data.expenseId, {
      ...updateFields,
      attachment: "",
    });
  } else {
    await pb.collection("expenses").update(parsed.data.expenseId, updateFields);
  }

  for (const [uid, amt] of Object.entries(split.amounts)) {
    const shareVal =
      parsed.data.splitMethod === "shares" && parsed.data.shares?.[uid]
        ? Math.floor(parsed.data.shares[uid])
        : null;
    const pctVal =
      parsed.data.splitMethod === "percentage" && parsed.data.percentages?.[uid] !== undefined
        ? new Decimal(parsed.data.percentages[uid]!.toFixed(2)).toFixed(2)
        : "";
    await pb.collection("expense_participants").create({
      expense: parsed.data.expenseId,
      user: uid,
      amount: new Decimal(amt.toFixed(2)).toFixed(2),
      shares: shareVal ?? undefined,
      percentage: pctVal || "",
    });
  }

  await pb.collection("activity_logs").create({
    user: user.id,
    group: parsed.data.groupId,
    type: ACTIVITY_TYPES.EXPENSE_UPDATED,
    metadata: {
      expenseId: parsed.data.expenseId,
      description: parsed.data.description,
      amount: convertedAmount,
      currency: groupCurrency,
    },
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const user = await requireUser();
  const pb = await getAdminPb();
  const exp = await pb.collection("expenses").getOne(expenseId);
  const groupId = String(recordField(exp, "group") ?? "");
  const memRows = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
  });
  if (!memRows.some((m) => String(recordField(m, "user") ?? "") === user.id)) {
    return { success: false, error: "Forbidden." };
  }

  const clearedSettlements = await removeExpenseAndClearSettlementsIfLedgerEmpty(expenseId, groupId);

  await pb.collection("activity_logs").create({
    user: user.id,
    group: groupId,
    type: ACTIVITY_TYPES.EXPENSE_DELETED,
    metadata: { expenseId, description: String(recordField(exp, "description") ?? "") },
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  revalidatePath("/settlements");
  revalidatePath("/groups");
  return {
    success: true,
    message: clearedSettlements
      ? "This group has no expenses left, so recorded settlements were cleared to keep balances consistent."
      : undefined,
  };
}
