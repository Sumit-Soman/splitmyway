"use server";

import { WorkerApiError, workerPostPublicJson } from "@/lib/worker/client";
import { setSessionToken, clearSessionToken } from "@/lib/auth/session-cookie";
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
    const data = await workerPostPublicJson<{
      token: string;
      user: { id: string; email: string; name: string | null };
    }>("/v1/auth/login", {
      email: parsed.data.email,
      password: parsed.data.password.trim(),
    });
    await setSessionToken(data.token);
    await ensureAppUserForAuth({ id: data.user.id }, data.token);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof WorkerApiError) {
      return { success: false, error: e.message };
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
    const data = await workerPostPublicJson<{
      token: string;
      user: { id: string };
    }>("/v1/auth/signup", {
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    await setSessionToken(data.token);
    await ensureAppUserForAuth({ id: data.user.id }, data.token);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof WorkerApiError) {
      return { success: false, error: e.message };
    }
    const err = e as { message?: string };
    return { success: false, error: err.message ?? "Could not create account." };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionToken();
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

  return {
    success: true,
    message:
      "Password reset email is not wired to the Worker backend yet. Ask an admin to rotate your password in D1 or use a direct DB update.",
  };
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
    const { workerFetchJson } = await import("@/lib/worker/client");
    const { token } = await workerFetchJson<{ token: string }>(`/v1/me/password`, {
      method: "POST",
      json: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
    });
    await setSessionToken(token);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof WorkerApiError) {
      return {
        success: false,
        error: e.message,
        fieldErrors: { currentPassword: ["Check your current password."] },
      };
    }
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
  try {
    return await ensureAppUserForAuth(user);
  } catch (e) {
    if (e instanceof WorkerApiError && e.status === 404) {
      redirect("/api/auth/session-reset");
    }
    throw e;
  }
}
