"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/actions/auth";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function ChangePasswordForm() {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => changePassword(_prev, formData),
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast({ title: "Password updated", description: state.message ?? "You can use your new password next time you sign in." });
      formRef.current?.reset();
    } else if (state && !state.success) {
      toast({ title: "Could not update password", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        {state && !state.success && state.fieldErrors?.currentPassword?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.currentPassword[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        {state && !state.success && state.fieldErrors?.newPassword?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.newPassword[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
        {state && !state.success && state.fieldErrors?.confirmPassword?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.confirmPassword[0]}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
