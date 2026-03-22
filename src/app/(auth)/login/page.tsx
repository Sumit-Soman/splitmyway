"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect } from "react";
import { login } from "@/actions/auth";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Loading } from "@/components/shared/loading";

function LoginForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  const [state, action, pending] = useActionState(login, null as ActionResult | null);

  useEffect(() => {
    if (state && !state.success) {
      toast({ title: "Sign in failed", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription className="text-base leading-relaxed">Sign in to continue to SplitMyWay.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state && !state.success && state.fieldErrors?.email?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            {state && !state.success && state.fieldErrors?.password?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.password[0]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          <Link href="/forgot-password" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-neutral-600">
          No account?{" "}
          <Link href="/signup" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginForm />
    </Suspense>
  );
}
