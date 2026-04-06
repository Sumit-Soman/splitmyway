"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/server-user";
import { getAdminPb } from "@/lib/pocketbase/admin";
import { recordField } from "@/lib/pocketbase/record-field";
import { MAX_PROFILE_AVATAR_BYTES } from "@/lib/constants";
import type { ActionResult } from "@/types";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadProfileAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const file = formData.get("avatar");
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Choose an image file." };
  }
  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    return { success: false, error: "Image must be 2 MB or smaller." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { success: false, error: "Use JPEG, PNG, WebP, or GIF." };
  }

  try {
    const pb = await getAdminPb();
    const fd = new FormData();
    fd.append("avatar", file);
    await pb.collection("users").update(user.id, fd);
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

  const pb = await getAdminPb();
  const row = await pb.collection("users").getOne(user.id);
  if (!recordField(row, "avatar")) {
    return { success: true, message: "No photo to remove." };
  }

  await pb.collection("users").update(user.id, { avatar: null });

  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return { success: true, message: "Profile photo removed." };
}
