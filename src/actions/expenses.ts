"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/server-user";
import { getRate } from "@/lib/exchange-rates";
import { calculateSplit } from "@/lib/calculations/splits";
import { createExpenseSchema } from "@/lib/validations/expense";
import { ACTIVITY_TYPES } from "@/lib/constants";
import type { ActionResult } from "@/types";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { removeExpenseAndClearSettlementsIfLedgerEmpty } from "@/lib/ledger/expense-deletion";

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

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    include: { members: true },
  });
  if (!group) {
    return { success: false, error: "Group not found." };
  }

  const isMember = group.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return { success: false, error: "Not a member of this group." };
  }

  const memberIds = new Set(group.members.map((m) => m.userId));
  for (const pid of parsed.data.participantIds) {
    if (!memberIds.has(pid)) {
      return { success: false, error: "All participants must be group members." };
    }
  }

  const inputAmount = parsed.data.amount;
  const expenseCurrency = parsed.data.currency.toUpperCase();
  const groupCurrency = group.currency.toUpperCase();

  let convertedAmount = inputAmount;
  let originalAmount: Decimal | null = null;
  let originalCurrency: string | null = null;
  let exchangeRate: Decimal | null = null;

  if (expenseCurrency !== groupCurrency) {
    const rate = await getRate(expenseCurrency, groupCurrency);
    convertedAmount = Math.round(inputAmount * rate * 100) / 100;
    originalAmount = new Decimal(inputAmount.toFixed(2));
    originalCurrency = expenseCurrency;
    exchangeRate = new Decimal(rate.toFixed(8));
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

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        groupId: parsed.data.groupId,
        paidById: parsed.data.paidById,
        description: parsed.data.description,
        amount: new Decimal(convertedAmount.toFixed(2)),
        currency: groupCurrency,
        originalAmount,
        originalCurrency,
        exchangeRate,
        category: parsed.data.category,
        date: parsed.data.date,
        notes: parsed.data.notes,
        splitMethod: parsed.data.splitMethod,
      },
    });

    for (const [uid, amt] of Object.entries(split.amounts)) {
      await tx.expenseParticipant.create({
        data: {
          expenseId: expense.id,
          userId: uid,
          amount: new Decimal(amt.toFixed(2)),
          shares:
            parsed.data.splitMethod === "shares" && parsed.data.shares?.[uid]
              ? Math.floor(parsed.data.shares[uid])
              : null,
          percentage:
            parsed.data.splitMethod === "percentage" && parsed.data.percentages?.[uid] !== undefined
              ? new Decimal(parsed.data.percentages[uid]!.toFixed(2))
              : null,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: user.id,
        groupId: parsed.data.groupId,
        type: ACTIVITY_TYPES.EXPENSE_ADDED,
        metadata: {
          expenseId: expense.id,
          description: parsed.data.description,
          amount: convertedAmount,
          currency: groupCurrency,
        },
      },
    });
  });

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const user = await requireUser();
  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { group: { include: { members: true } } },
  });
  if (!exp) {
    return { success: false, error: "Expense not found." };
  }

  const isMember = exp.group.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return { success: false, error: "Forbidden." };
  }

  let clearedSettlements = false;
  await prisma.$transaction(async (tx) => {
    clearedSettlements = await removeExpenseAndClearSettlementsIfLedgerEmpty(tx, expenseId, exp.groupId);
    await tx.activityLog.create({
      data: {
        userId: user.id,
        groupId: exp.groupId,
        type: ACTIVITY_TYPES.EXPENSE_DELETED,
        metadata: { expenseId, description: exp.description },
      },
    });
  });

  revalidatePath(`/groups/${exp.groupId}`);
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
