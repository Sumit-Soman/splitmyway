"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUser, getDbUserById } from "@/lib/auth/server-user";
import { z } from "zod";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";

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

  await prisma.user.update({
    where: { id: user.id },
    data: {
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

  return getDbUserById(user.id);
}
