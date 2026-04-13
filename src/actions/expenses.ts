"use server";

import { requireUser } from "@/lib/auth/server-user";
import { getRate } from "@/lib/exchange-rates";
import { calculateSplit } from "@/lib/calculations/splits";
import { createExpenseSchema, updateExpenseSchema } from "@/lib/validations/expense";
import { MAX_EXPENSE_ATTACHMENT_BYTES, MAX_EXPENSE_ATTACHMENT_LABEL } from "@/lib/constants";
import type { ActionResult } from "@/types";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { removeExpenseAndClearSettlementsIfLedgerEmpty } from "@/lib/ledger/expense-deletion";
import { findMembership } from "@/lib/pocketbase/queries";
import { WorkerApiError, workerFetchJson } from "@/lib/worker/client";

function expenseApiFailureMessage(err: unknown): string {
  if (err instanceof WorkerApiError) {
    const m = err.message;
    if (
      /TOOBIG|string or blob too big|ATTACHMENT_TOO_LARGE|database storage limit|D1_ERROR/i.test(m)
    ) {
      return `Receipt must be ${MAX_EXPENSE_ATTACHMENT_LABEL} or smaller (storage limit). Remove the file or use a smaller image.`;
    }
    return m;
  }
  return "Something went wrong. Try again.";
}

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

async function fileToAttachmentParts(att: File | null): Promise<{ attachmentBase64: string; attachmentMime: string } | null> {
  if (!att || att.size === 0) return null;
  if (att.size > MAX_EXPENSE_ATTACHMENT_BYTES) {
    throw new Error(`Attachment must be ${MAX_EXPENSE_ATTACHMENT_LABEL} or smaller.`);
  }
  const buf = Buffer.from(await att.arrayBuffer());
  return { attachmentBase64: buf.toString("base64"), attachmentMime: att.type || "application/octet-stream" };
}

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

  const mem = await findMembership(user.id, parsed.data.groupId);
  if (!mem) {
    return { success: false, error: "Not a member of this group." };
  }

  let group: { currency: string };
  try {
    const res = await workerFetchJson<{ group: { currency: string } }>(
      `/v1/groups/${encodeURIComponent(parsed.data.groupId)}`
    );
    group = res.group;
  } catch (e) {
    return { success: false, error: expenseApiFailureMessage(e) };
  }

  const inputAmount = parsed.data.amount;
  const expenseCurrency = parsed.data.currency.toUpperCase();
  const groupCurrency = group.currency.toUpperCase();

  let convertedAmount = inputAmount;
  let originalAmountMinor: number | null = null;
  let originalCurrency: string | null = null;
  let exchangeRateE8: number | null = null;

  if (expenseCurrency !== groupCurrency) {
    const rate = await getRate(expenseCurrency, groupCurrency);
    convertedAmount = Math.round(inputAmount * rate * 100) / 100;
    originalAmountMinor = toMinor(inputAmount);
    originalCurrency = expenseCurrency;
    exchangeRateE8 = Math.round(Number(new Decimal(rate.toFixed(8)).toFixed(8)) * 1e8);
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

  const amountMinor = toMinor(convertedAmount);
  const exactCents =
    parsed.data.splitMethod === "exact" && parsed.data.exactAmounts
      ? Object.fromEntries(
          Object.entries(parsed.data.exactAmounts).map(([k, v]) => [k, toMinor(v)])
        )
      : undefined;

  const att = formData.get("attachment");
  let attachment: { attachmentBase64: string; attachmentMime: string } | null = null;
  if (att instanceof File && att.size > 0) {
    try {
      attachment = await fileToAttachmentParts(att);
      if (!attachment) {
        return { success: false, error: "Invalid attachment." };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid attachment.";
      return { success: false, error: msg };
    }
  }

  try {
    await workerFetchJson(`/v1/expenses`, {
      method: "POST",
      json: {
        groupId: parsed.data.groupId,
        description: parsed.data.description,
        amountMinor,
        currency: groupCurrency,
        category: parsed.data.category,
        date: parsed.data.date.toISOString(),
        paidById: parsed.data.paidById,
        notes: parsed.data.notes ?? null,
        splitMethod: parsed.data.splitMethod,
        participantIds: parsed.data.participantIds,
        originalAmountMinor,
        originalCurrency,
        exchangeRateE8,
        exactCents,
        percentages: parsed.data.percentages,
        shares: parsed.data.shares,
        attachmentBase64: attachment?.attachmentBase64 ?? null,
        attachmentMime: attachment?.attachmentMime ?? null,
      },
    });
  } catch (e) {
    return { success: false, error: expenseApiFailureMessage(e) };
  }

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

  const mem = await findMembership(user.id, parsed.data.groupId);
  if (!mem) {
    return { success: false, error: "Not a member of this group." };
  }

  let group: { currency: string };
  try {
    const res = await workerFetchJson<{ group: { currency: string } }>(
      `/v1/groups/${encodeURIComponent(parsed.data.groupId)}`
    );
    group = res.group;
  } catch (e) {
    return { success: false, error: expenseApiFailureMessage(e) };
  }

  const inputAmount = parsed.data.amount;
  const expenseCurrency = parsed.data.currency.toUpperCase();
  const groupCurrency = group.currency.toUpperCase();

  let convertedAmount = inputAmount;
  let originalAmountMinor: number | null = null;
  let originalCurrency: string | null = null;
  let exchangeRateE8: number | null = null;

  if (expenseCurrency !== groupCurrency) {
    const rate = await getRate(expenseCurrency, groupCurrency);
    convertedAmount = Math.round(inputAmount * rate * 100) / 100;
    originalAmountMinor = toMinor(inputAmount);
    originalCurrency = expenseCurrency;
    exchangeRateE8 = Math.round(Number(new Decimal(rate.toFixed(8)).toFixed(8)) * 1e8);
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

  const amountMinor = toMinor(convertedAmount);
  const exactCents =
    parsed.data.splitMethod === "exact" && parsed.data.exactAmounts
      ? Object.fromEntries(
          Object.entries(parsed.data.exactAmounts).map(([k, v]) => [k, toMinor(v)])
        )
      : undefined;

  const newAtt = formData.get("attachment");
  const removeAttachment = formData.get("removeAttachment") === "1";

  let attachmentBase64: string | null = null;
  let attachmentMime: string | null = null;
  if (newAtt instanceof File && newAtt.size > 0) {
    try {
      const parts = await fileToAttachmentParts(newAtt);
      if (!parts) {
        return { success: false, error: "Invalid attachment." };
      }
      attachmentBase64 = parts.attachmentBase64;
      attachmentMime = parts.attachmentMime;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid attachment.";
      return { success: false, error: msg };
    }
  } else if (removeAttachment) {
    attachmentBase64 = "";
    attachmentMime = "";
  }

  try {
    await workerFetchJson(`/v1/expenses/${encodeURIComponent(parsed.data.expenseId)}`, {
      method: "PATCH",
      json: {
        expenseId: parsed.data.expenseId,
        groupId: parsed.data.groupId,
        description: parsed.data.description,
        amountMinor,
        currency: groupCurrency,
        category: parsed.data.category,
        date: parsed.data.date.toISOString(),
        paidById: parsed.data.paidById,
        notes: parsed.data.notes ?? null,
        splitMethod: parsed.data.splitMethod,
        participantIds: parsed.data.participantIds,
        originalAmountMinor,
        originalCurrency,
        exchangeRateE8,
        exactCents,
        percentages: parsed.data.percentages,
        shares: parsed.data.shares,
        attachmentBase64,
        attachmentMime,
      },
    });
  } catch (e) {
    return { success: false, error: expenseApiFailureMessage(e) };
  }

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  await requireUser();
  const { clearedSettlements, groupId } = await removeExpenseAndClearSettlementsIfLedgerEmpty(
    expenseId,
    ""
  );

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
