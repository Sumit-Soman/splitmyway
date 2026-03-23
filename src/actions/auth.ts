"use server";

import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    if (signInData.user) {
      await ensureAppUserForAuth(signInData.user);
    }
  } catch (e) {
    unstable_rethrow(e);
    throw e;
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
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { name: parsed.data.name },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/callback`,
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const userId = data.user?.id;
    if (!userId) {
      return {
        success: false,
        error: "Account created. Please check your email to confirm before signing in.",
      };
    }

    if (data.user) {
      await ensureAppUserForAuth(data.user);
    }
  } catch (e) {
    unstable_rethrow(e);
    throw e;
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
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
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl}/callback`,
    });
    if (error) {
      return { success: false, error: error.message };
    }
  } catch (e) {
    unstable_rethrow(e);
    throw e;
  }

  return { success: true, message: "Check your email for a password reset link." };
}

export async function changePassword(
  _prev: ActionResult | null,
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
    const supabase = await createClient();
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: parsed.data.currentPassword,
    });
    if (verifyErr) {
      return {
        success: false,
        error: "Current password is incorrect, or this account only uses social sign-in.",
        fieldErrors: { currentPassword: ["Check your current password."] },
      };
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });
    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
  } catch (e) {
    unstable_rethrow(e);
    throw e;
  }

  return { success: true, message: "Your password was updated." };
}

export async function getCurrentUser() {
  const user = await getAuthUser();
  if (!user) return null;
  return ensureAppUserForAuth(user);
}
