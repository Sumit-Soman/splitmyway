import { getProfile } from "@/actions/profile";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsProfilePage() {
  const profile = await getProfile();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="app-label-caps text-neutral-500">Account</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-900">Profile</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-neutral-600">
          Your display name and preferred currency are used on the dashboard, in groups, and on exports.
        </p>
      </div>

      <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-base font-semibold">Details</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Signed in as <span className="font-medium text-neutral-700">{profile.email}</span>. Email
            cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <SettingsForm defaultName={profile.name ?? ""} defaultCurrency={profile.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
