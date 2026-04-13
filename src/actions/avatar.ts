"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/server-user";
import type { ActionResult } from "@/types";
import { workerFetchForm, workerFetchJson } from "@/lib/worker/client";

export async function uploadProfileAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const file = formData.get("avatar");
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Choose an image file." };
  }

  const fd = new FormData();
  fd.append("avatar", file);

  try {
    await workerFetchForm(`/v1/me/avatar`, fd, "POST");
  } catch (e) {
    const err = e as { message?: string };
    return {
      success: false,
      error: err.message ?? "Upload failed.",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return { success: true, message: "Profile photo updated." };
}

export async function removeProfileAvatar(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  await workerFetchJson(`/v1/me/avatar`, { method: "DELETE" });

  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return { success: true, message: "Profile photo removed." };
}
