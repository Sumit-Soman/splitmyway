"use server";

import { getAuthUser } from "@/lib/auth/server-user";
import { z } from "zod";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";
import { workerFetchJson } from "@/lib/worker/client";

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  currency: z.string().length(3),
});

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await workerFetchJson(`/v1/me`, {
    method: "PATCH",
    json: {
      name: parsed.data.name,
      currency: parsed.data.currency.toUpperCase(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getProfile() {
  const user = await getAuthUser();
  if (!user) return null;

  const { getAppUserById } = await import("@/lib/pocketbase/queries");
  return getAppUserById(user.id);
}
