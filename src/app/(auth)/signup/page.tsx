"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { signup } from "@/actions/auth";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function SignupPage() {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => signup(prev, formData),
    null
  );

  useEffect(() => {
    if (state && !state.success) {
      toast({ title: "Could not create account", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription className="text-base leading-relaxed">Start splitting expenses in minutes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
            {state && !state.success && state.fieldErrors?.name?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state && !state.success && state.fieldErrors?.email?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
            {state && !state.success && state.fieldErrors?.password?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
            {state && !state.success && state.fieldErrors?.confirmPassword?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.confirmPassword[0]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
