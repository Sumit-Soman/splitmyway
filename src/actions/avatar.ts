"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/server-user";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const AVATAR_BUCKET = "avatars";

export async function uploadProfileAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const file = formData.get("avatar");
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Choose an image file." };
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: "Image must be 2 MB or smaller." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { success: false, error: "Use JPEG, PNG, WebP, or GIF." };
  }

  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "gif";

  const supabase = await createClient();
  const folder = user.id;
  const { data: existing } = await supabase.storage.from(AVATAR_BUCKET).list(folder);
  if (existing?.length) {
    await supabase.storage.from(AVATAR_BUCKET).remove(existing.map((f) => `${folder}/${f.name}`));
  }

  const path = `${folder}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return {
      success: false,
      error:
        uploadError.message.includes("Bucket not found") || uploadError.message.includes("not found")
          ? `Storage bucket "${AVATAR_BUCKET}" is missing. Create a public bucket named "${AVATAR_BUCKET}" in Supabase (Storage) and allow authenticated uploads.`
          : uploadError.message,
    };
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: pub.publicUrl },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return { success: true, message: "Profile photo updated." };
}

export async function removeProfileAvatar(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  if (!row?.avatarUrl) {
    return { success: true, message: "No photo to remove." };
  }

  const supabase = await createClient();
  const folder = user.id;
  const { data: listed } = await supabase.storage.from(AVATAR_BUCKET).list(folder);
  if (listed?.length) {
    const paths = listed.map((f) => `${folder}/${f.name}`);
    await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: null },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return { success: true, message: "Profile photo removed." };
}
