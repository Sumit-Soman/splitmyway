"use server";

import { requireUser } from "@/lib/auth/server-user";
import { settlementSchema } from "@/lib/validations/expense";
import type { ActionResult } from "@/types";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { workerFetchJson } from "@/lib/worker/client";

export async function createSettlement(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();
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

  const amountMinor = Math.round(parsed.data.amount * 100);

  await workerFetchJson(`/v1/payments`, {
    method: "POST",
    json: {
      groupId: parsed.data.groupId,
      fromId: parsed.data.fromId,
      toId: parsed.data.toId,
      amountMinor,
      notes: parsed.data.notes ?? null,
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
  await requireUser();
  const { settlements } = await workerFetchJson<{
    settlements: Array<{
      id: string;
      groupId: string;
      groupName: string;
      currency: string;
      amount: number;
      notes: string | null;
      settledAt: string;
      from: { id: string; name: string | null; email: string };
      to: { id: string; name: string | null; email: string };
      youPaid: boolean;
      youReceived: boolean;
    }>;
  }>(`/v1/payments`);
  return settlements;
}
