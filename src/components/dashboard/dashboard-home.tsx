import Link from "next/link";
import { format } from "date-fns";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  ChevronRight,
  CircleDot,
  Plus,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { DashboardData } from "@/actions/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MemberDot, MemberName } from "@/components/shared/member-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/constants";

type ActivityItem = {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: string;
  groupName: string | null;
  groupId: string | null;
};

function netBalanceSummary(net: number): { headline: string; detail: string } {
  if (net > 0.001) {
    return {
      headline: "Overall, the groups owe you money.",
      detail: "This is your combined net balance after splits and recorded payments.",
    };
  }
  if (net < -0.001) {
    return {
      headline: "Overall, you owe money across your groups.",
      detail: "Settling the suggestions below (or equivalent payments) brings everyone to even.",
    };
  }
  return {
    headline: "You’re even across all groups.",
    detail: "No net balance to collect or pay right now.",
  };
}

function formatActivity(type: string, metadata: unknown) {
  const m = metadata as Record<string, unknown> | null;
  switch (type) {
    case ACTIVITY_TYPES.EXPENSE_ADDED:
      return `Expense added: ${String(m?.description ?? "Expense")}`;
    case ACTIVITY_TYPES.EXPENSE_UPDATED:
      return `Expense updated: ${String(m?.description ?? "Expense")}`;
    case ACTIVITY_TYPES.EXPENSE_DELETED:
      return `Expense removed: ${String(m?.description ?? "")}`;
    case ACTIVITY_TYPES.SETTLEMENT_RECORDED:
      return "Settlement recorded";
    case ACTIVITY_TYPES.MEMBER_ADDED:
      return `Member added: ${String(m?.email ?? "")}`;
    case ACTIVITY_TYPES.MEMBER_REMOVED:
      return "Member removed";
    case ACTIVITY_TYPES.GROUP_CREATED:
      return `Group created: ${String(m?.groupName ?? "")}`;
    default:
      return type;
  }
}

function activityIcon(type: string) {
  switch (type) {
    case ACTIVITY_TYPES.EXPENSE_ADDED:
    case ACTIVITY_TYPES.EXPENSE_UPDATED:
    case ACTIVITY_TYPES.EXPENSE_DELETED:
      return Receipt;
    case ACTIVITY_TYPES.SETTLEMENT_RECORDED:
      return ArrowRightLeft;
    case ACTIVITY_TYPES.MEMBER_ADDED:
    case ACTIVITY_TYPES.MEMBER_REMOVED:
      return UserPlus;
    case ACTIVITY_TYPES.GROUP_CREATED:
      return Users;
    default:
      return CircleDot;
  }
}

export function DashboardHome({
  data,
  activity,
  userId,
}: {
  data: DashboardData;
  activity: ActivityItem[];
  userId: string;
}) {
  const displayName = data.user?.name ?? data.user?.email ?? "there";
  const prefCurrency = data.user?.currency ?? "USD";
  const { headline, detail } = netBalanceSummary(data.netBalance);

  const sortedGroups = [...data.groups].sort((a, b) => {
    const aNeeds = Math.abs(a.yourBalance) > 0.001 ? 1 : 0;
    const bNeeds = Math.abs(b.yourBalance) > 0.001 ? 1 : 0;
    if (aNeeds !== bNeeds) return bNeeds - aNeeds;
    return a.name.localeCompare(b.name);
  });

  const multiCurrencyGroups = new Set(data.groups.map((g) => g.currency)).size > 1;

  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-100 pb-6">
        <h1 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xl font-medium tracking-tight text-neutral-600 sm:text-2xl">
          Hello,
          <span className="text-3xl font-bold text-neutral-900 sm:text-[2.25rem] sm:leading-tight">{displayName}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-800">{headline}</p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500">{detail}</p>
      </header>

      <section aria-label="Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className={cn(
              "flex gap-4 rounded-xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
              data.netBalance > 0.001
                ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white"
                : data.netBalance < -0.001
                  ? "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white"
                  : "border-neutral-200/90 bg-white"
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                data.netBalance > 0.001
                  ? "bg-emerald-100 text-emerald-800"
                  : data.netBalance < -0.001
                    ? "bg-rose-100 text-rose-800"
                    : "bg-neutral-100 text-neutral-600"
              )}
            >
              <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="app-label-caps">Net across groups</p>
              <p className="app-text-caption mt-1">
                {multiCurrencyGroups
                  ? "Sum of per-group balances (no FX). Open each group for amounts in that group’s currency."
                  : "After splits and recorded settlements, across all your groups."}
              </p>
              <div className="mt-2">
                {Math.abs(data.netBalance) < 0.001 ? (
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-400">Even</span>
                ) : (
                  <CurrencyDisplay
                    className="text-2xl"
                    amount={Math.abs(data.netBalance)}
                    currency={prefCurrency}
                    direction={data.netBalance >= 0 ? "owed-to-you" : "you-owe"}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
              <Users className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="app-label-caps">Active groups</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-neutral-900">{data.activeGroups}</p>
              <p className="mt-1 text-xs text-neutral-500">Shared expense spaces you belong to</p>
            </div>
          </div>

          <div className="flex gap-4 rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:col-span-2 lg:col-span-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <ArrowRightLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="app-label-caps">Suggested transfers</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-neutral-900">{data.pendingSettlements}</p>
              <p className="mt-1 text-xs text-neutral-500">Payments that involve you in the minimized plan</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="dash-groups-heading">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="dash-groups-heading" className="text-lg font-semibold tracking-tight text-neutral-900">
                Your groups
              </h2>
              <p className="text-sm text-neutral-500">Spend and your balance in each group.</p>
            </div>
          </div>
          <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardContent className="p-0">
              {sortedGroups.length === 0 ? (
                <div className="p-6 text-sm text-neutral-600">
                  <p>No groups yet.</p>
                  <Link href="/groups/new" className={cn(buttonVariants(), "mt-4 inline-flex")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first group
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {sortedGroups.map((g) => (
                    <li key={g.id} data-e2e-dashboard-group={g.name}>
                      <Link
                        href={`/groups/${g.id}`}
                        className="group flex flex-col gap-4 p-5 transition-colors hover:bg-neutral-50/80 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-neutral-900 group-hover:text-neutral-950">{g.name}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 opacity-70" aria-hidden />
                              {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                            </span>
                            <span className="text-neutral-300" aria-hidden>
                              ·
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-wide">{g.currency}</span>
                          </p>
                        </div>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
                          <div className="sm:text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Your balance</p>
                            <div className="mt-1">
                              {Math.abs(g.yourBalance) < 0.001 ? (
                                <span className="text-sm font-medium text-neutral-400">Settled</span>
                              ) : (
                                <CurrencyDisplay
                                  amount={Math.abs(g.yourBalance)}
                                  currency={g.currency}
                                  direction={g.yourBalance >= 0 ? "owed-to-you" : "you-owe"}
                                />
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-neutral-500">
                              {g.yourBalance > 0.001
                                ? "Group owes you"
                                : g.yourBalance < -0.001
                                  ? "You owe the group"
                                  : "Even in this group"}
                            </p>
                          </div>
                          <div className="border-t border-neutral-100 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Total spend</p>
                            <p
                              className="mt-1 text-sm font-semibold tabular-nums text-neutral-800"
                              data-e2e-total-spend
                            >
                              {formatCurrency(g.totalSpend, g.currency)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          className="hidden h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500 sm:block"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {sortedGroups.length > 0 ? (
                <div className="border-t border-neutral-100 p-4">
                  <Link
                    href="/groups/new"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full justify-center sm:w-auto"
                    )}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New group
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="dash-settlements-heading">
          <div className="mb-4">
            <h2 id="dash-settlements-heading" className="text-lg font-semibold tracking-tight text-neutral-900">
              Settlement suggestions
            </h2>
            <p className="text-sm text-neutral-500">Who should pay whom next — only transfers that involve you.</p>
          </div>
          <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardContent className="space-y-3 p-5">
              {data.suggestions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-neutral-800">You&apos;re all caught up</p>
                  <p className="mt-1 text-sm text-neutral-500">No payments involving you are needed in the current plan.</p>
                </div>
              ) : (
                data.suggestions.map((s, i) => {
                  const youOwe = s.fromId === userId;
                  const youGet = s.toId === userId;
                  return (
                    <div
                      key={`${s.groupId}-${i}`}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-white shadow-sm",
                        youOwe ? "border-rose-200/70" : youGet ? "border-emerald-200/70" : "border-neutral-200"
                      )}
                    >
                      <div
                        className={cn(
                          "border-b px-4 py-2.5",
                          youOwe ? "border-rose-100 bg-rose-50/50" : youGet ? "border-emerald-100 bg-emerald-50/50" : "border-neutral-100 bg-neutral-50/50"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{s.groupName}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              youOwe ? "bg-rose-100 text-rose-800" : youGet ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-700"
                            )}
                          >
                            {youOwe ? "You pay" : youGet ? "You receive" : "Involves you"}
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-4">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-800">
                          <MemberDot userId={s.fromId} />
                          <MemberName userId={s.fromId} className="font-medium">
                            {s.fromName}
                          </MemberName>
                          <ArrowRight className="h-3.5 w-3.5 text-neutral-300" aria-hidden />
                          <MemberDot userId={s.toId} />
                          <MemberName userId={s.toId} className="font-medium">
                            {s.toName}
                          </MemberName>
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <CurrencyDisplay
                            amount={s.amount}
                            currency={s.currency}
                            direction={youOwe ? "you-owe" : youGet ? "owed-to-you" : "neutral"}
                            className="text-lg"
                          />
                          <Link
                            href={`/groups/${s.groupId}`}
                            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                          >
                            Open group
                            <ChevronRight className="ml-1 h-4 w-4 opacity-70" aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby="dash-activity-heading">
        <Card className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="border-b border-neutral-100 pb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <Activity className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <CardTitle id="dash-activity-heading" className="text-lg">
                    Recent activity
                  </CardTitle>
                  <CardDescription>Latest updates from groups you&apos;re in.</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <p className="p-6 text-sm text-neutral-600">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {activity.map((a) => {
                  const Icon = activityIcon(a.type);
                  return (
                    <li key={a.id} className="flex gap-4 px-5 py-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-600">
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <time className="text-xs font-medium tabular-nums text-neutral-500" dateTime={a.createdAt}>
                            {format(new Date(a.createdAt), "MMM d, yyyy · HH:mm")}
                          </time>
                          {a.groupName ? (
                            <>
                              <span className="text-neutral-300" aria-hidden>
                                ·
                              </span>
                              {a.groupId ? (
                                <Link
                                  href={`/groups/${a.groupId}`}
                                  className="text-xs font-semibold uppercase tracking-wide text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                                >
                                  {a.groupName}
                                </Link>
                              ) : (
                                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{a.groupName}</span>
                              )}
                            </>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{formatActivity(a.type, a.metadata)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
