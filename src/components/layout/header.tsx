"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth";
import { MemberAvatar } from "@/components/shared/member-avatar";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/settlements", label: "Settlements" },
  { href: "/reports", label: "Reports" },
];

export function Header({
  user,
}: {
  user: { id: string; name: string | null; email: string; avatarUrl?: string | null };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight text-neutral-900">
            Split<span className="font-bold text-blue-600">MyWay</span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-2 text-[15px] font-medium transition-colors",
                  pathname === l.href || pathname.startsWith(l.href + "/")
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="e2e-user-menu"
              className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-neutral-50"
            >
              <MemberAvatar
                userId={user.id}
                name={user.name}
                email={user.email}
                avatarUrl={user.avatarUrl}
                className="h-9 w-9 text-[10px]"
              />
              <span className="hidden max-w-[10rem] truncate text-[15px] text-neutral-600 lg:inline">
                {user.name ?? user.email}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <Link
                href="/settings"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] text-neutral-700 hover:bg-neutral-50"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[15px] text-neutral-700 hover:bg-neutral-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="border-t border-neutral-100 px-4 py-2 sm:px-6 md:hidden">
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-2 py-1.5 text-[13px] font-medium",
                pathname === l.href || pathname.startsWith(l.href + "/")
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-500"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
