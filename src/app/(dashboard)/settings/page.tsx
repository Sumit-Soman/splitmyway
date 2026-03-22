import { getProfile } from "@/actions/profile";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-heading">Settings</h1>
        <p className="page-subheading">Update your profile and preferred currency.</p>
      </div>
      <Card className="max-w-xl border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Changes apply across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm defaultName={profile.name ?? ""} defaultCurrency={profile.currency} />
        </CardContent>
      </Card>
    </div>
  );
}
