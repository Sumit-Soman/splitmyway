"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/settings/profile",
    label: "Profile",
    hint: "Name & currency",
    icon: UserRound,
  },
  {
    href: "/settings/password",
    label: "Password",
    hint: "Email sign-in",
    icon: KeyRound,
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections">
      <p className="app-label-caps mb-3 text-neutral-500">Sections</p>
      <ul className="flex gap-0 border-b border-neutral-200 lg:flex-col lg:border-b-0 lg:gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1 lg:flex-none">
              <Link
                href={item.href}
                className={cn(
                  "flex items-start gap-2.5 border-b-2 py-3 text-left transition-colors lg:border-b-0 lg:border-l-2 lg:py-2.5 lg:pl-4 lg:pr-2",
                  active
                    ? "border-neutral-900 bg-neutral-50/80 text-neutral-900 lg:rounded-r-md"
                    : "border-transparent text-neutral-600 hover:bg-neutral-50/60 hover:text-neutral-900"
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    active ? "text-neutral-900" : "text-neutral-400"
                  )}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                  <span className="mt-0.5 hidden text-xs font-normal leading-snug text-neutral-500 sm:block">
                    {item.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
