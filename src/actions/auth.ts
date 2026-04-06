"use server";

import PocketBase, { ClientResponseError } from "pocketbase";
import { getPocketBaseUrl } from "@/lib/pocketbase/server";
import { clearPbAuthCookie, setPbAuthCookie } from "@/lib/pocketbase/cookies";
import { getAuthUser } from "@/lib/auth/server-user";
import { ensureAppUserForAuth } from "@/lib/auth/ensure-app-user";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/types";
import { redirect, unstable_rethrow } from "next/navigation";
import { createUserPbFromCookies } from "@/lib/pocketbase/server";

export async function login(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const pb = new PocketBase(getPocketBaseUrl());
    const password = parsed.data.password.trim();
    await pb.collection("users").authWithPassword(parsed.data.email, password);
    await setPbAuthCookie(pb);
    if (pb.authStore.record) {
      await ensureAppUserForAuth(pb.authStore.record);
    }
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ClientResponseError) {
      const msg =
        (e.response as { message?: string } | undefined)?.message ??
        e.message ??
        "Sign in failed.";
      return { success: false, error: msg };
    }
    const err = e as { message?: string };
    return { success: false, error: err.message ?? "Sign in failed." };
  }

  const next = String(formData.get("next") ?? "") || "/dashboard";
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signup(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const pb = new PocketBase(getPocketBaseUrl());
    await pb.collection("users").create({
      email: parsed.data.email,
      password: parsed.data.password,
      passwordConfirm: parsed.data.password,
      name: parsed.data.name,
      currency: "USD",
    });
    await pb.collection("users").authWithPassword(parsed.data.email, parsed.data.password);
    await setPbAuthCookie(pb);
    if (pb.authStore.record) {
      await ensureAppUserForAuth(pb.authStore.record);
    }
  } catch (e) {
    unstable_rethrow(e);
    const err = e as { message?: string; data?: { data?: { email?: { message?: string } } } };
    const msg =
      err.data?.data?.email?.message ?? err.message ?? "Could not create account.";
    return { success: false, error: msg };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearPbAuthCookie();
  redirect("/");
}

export async function forgotPassword(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const pb = new PocketBase(getPocketBaseUrl());
    await pb.collection("users").requestPasswordReset(parsed.data.email);
  } catch (e) {
    unstable_rethrow(e);
    const err = e as { message?: string };
    return { success: false, error: err.message ?? "Request failed." };
  }

  return { success: true, message: "Check your email for a password reset link." };
}

export async function changePassword(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const authUser = await getAuthUser();
  if (!authUser?.email) {
    return {
      success: false,
      error: "You must be signed in with email to change your password.",
    };
  }

  try {
    const pb = await createUserPbFromCookies();
    if (!pb.authStore.record) {
      return { success: false, error: "Unauthorized" };
    }
    await pb.collection("users").update(pb.authStore.record.id, {
      oldPassword: parsed.data.currentPassword,
      password: parsed.data.newPassword,
      passwordConfirm: parsed.data.confirmPassword,
    });
    await setPbAuthCookie(pb);
  } catch (e) {
    unstable_rethrow(e);
    const err = e as { message?: string };
    return {
      success: false,
      error: err.message ?? "Could not update password.",
      fieldErrors: { currentPassword: ["Check your current password."] },
    };
  }

  return { success: true, message: "Your password was updated." };
}

export async function getCurrentUser() {
  const user = await getAuthUser();
  if (!user) return null;
  return ensureAppUserForAuth(user);
}
