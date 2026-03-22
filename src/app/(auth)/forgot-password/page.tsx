"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { forgotPassword } from "@/actions/auth";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => forgotPassword(prev, formData),
    null
  );

  useEffect(() => {
    if (state?.success && state.message) {
      toast({ title: "Check your inbox", description: state.message });
    } else if (state && !state.success) {
      toast({ title: "Request failed", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Reset password</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          We&apos;ll email you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state && !state.success && state.fieldErrors?.email?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          <Link href="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
