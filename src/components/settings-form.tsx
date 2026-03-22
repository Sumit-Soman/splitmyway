"use client";

import { useActionState, useEffect } from "react";
import { updateProfile } from "@/actions/profile";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

export function SettingsForm({
  defaultName,
  defaultCurrency,
}: {
  defaultName: string;
  defaultCurrency: string;
}) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => updateProfile(_prev, formData),
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast({ title: "Saved", description: "Your profile was updated." });
    } else if (state && !state.success) {
      toast({ title: "Error", description: state.error, variant: "destructive" });
    }
  }, [state, toast]);

  return (
    <form action={action} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required />
        {state && !state.success && state.fieldErrors?.name?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Preferred currency</Label>
        <Select id="currency" name="currency" defaultValue={defaultCurrency}>
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
