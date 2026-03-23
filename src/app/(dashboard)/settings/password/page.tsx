import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPasswordPage() {
  return (
    <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight text-neutral-900">Password</CardTitle>
        <CardDescription className="max-w-lg text-sm leading-relaxed">
          Applies to email sign-in only. Minimum eight characters; use a unique password you do not reuse
          elsewhere.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ChangePasswordForm />
      </CardContent>
    </Card>
  );
}
