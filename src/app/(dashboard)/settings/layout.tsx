import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="page-heading">Settings</h1>
        <p className="page-subheading max-w-2xl text-neutral-600">
          Manage how you appear in the app and keep your sign-in credentials current.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
        <aside className="lg:w-60 lg:shrink-0">
          <SettingsNav />
        </aside>
        <div className="min-w-0 flex-1 lg:max-w-xl">{children}</div>
      </div>
    </div>
  );
}
