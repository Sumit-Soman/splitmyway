"use client";

import { useActionState, useEffect } from "react";
import { createGroup } from "@/actions/groups";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GROUP_CATEGORIES, CURRENCIES } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

export default function NewGroupPage() {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(createGroup, null as ActionResult | null);

  useEffect(() => {
    if (state && !state.success) {
      toast({ title: "Error", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <Card className="mx-auto max-w-lg border-neutral-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">New group</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Set a name, category, and default currency.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
            {state && !state.success && state.fieldErrors?.name?.[0] ? (
              <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue="other">
              {GROUP_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" name="currency" defaultValue="USD">
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create group"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
