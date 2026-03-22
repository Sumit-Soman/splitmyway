import Link from "next/link";
import { format } from "date-fns";
import { getDashboardData } from "@/actions/dashboard";
import { getRecentActivity } from "@/actions/activity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MemberDot } from "@/components/shared/member-avatar";
import { formatCurrency } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getDashboardData();
  const activity = await getRecentActivity(10);

  if (!data || !user) return null;

  const displayName = data.user?.name ?? data.user?.email ?? "there";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-heading">Hello, {displayName}</h1>
        <p className="page-subheading">Here&apos;s what&apos;s happening across your groups.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Total balance (all groups)</CardDescription>
            <CardTitle className="text-2xl">
              <CurrencyDisplay
                amount={Math.abs(data.netBalance)}
                currency={data.user?.currency ?? "USD"}
                direction={data.netBalance >= 0 ? "owed-to-you" : "you-owe"}
              />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Active groups</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.activeGroups}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Pending settlements</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.pendingSettlements}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle>Your groups</CardTitle>
            <CardDescription>Spend and members at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.groups.length === 0 ? (
              <p className="text-sm text-neutral-600">No groups yet. Create one to get started.</p>
            ) : (
              data.groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{g.name}</p>
                    <p className="text-xs text-neutral-500">
                      {g.memberCount} members · {g.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-neutral-900">
                      {formatCurrency(g.totalSpend, g.currency)}
                    </p>
                    <p className="text-xs text-neutral-500">total spend</p>
                  </div>
                </Link>
              ))
            )}
            <Link
              href="/groups/new"
              className="inline-block text-[15px] font-medium text-neutral-900 underline-offset-4 hover:underline"
            >
              + Create group
            </Link>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle>Settlement suggestions</CardTitle>
            <CardDescription>Who should pay whom next.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.suggestions.length === 0 ? (
              <p className="text-sm text-neutral-600">You&apos;re all caught up.</p>
            ) : (
              data.suggestions.map((s, i) => {
                const youOwe = s.fromId === user.id;
                const youGet = s.toId === user.id;
                return (
                  <div
                    key={`${s.groupId}-${i}`}
                    className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.groupName}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-neutral-800">
                      <MemberDot userId={s.fromId} />
                      <span>{s.fromName}</span>
                      <span className="text-neutral-400">→</span>
                      <MemberDot userId={s.toId} />
                      <span>{s.toName}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <CurrencyDisplay
                        amount={s.amount}
                        currency={s.currency}
                        direction={youOwe ? "you-owe" : youGet ? "owed-to-you" : "neutral"}
                      />
                      <Link
                        href={`/groups/${s.groupId}`}
                        className="text-xs font-medium text-neutral-900 underline-offset-4 hover:underline"
                      >
                        Open group
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-neutral-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-neutral-600">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-col gap-1.5 border-b border-neutral-100 pb-4 text-[15px] leading-relaxed last:border-0">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {format(new Date(a.createdAt), "MMM d, yyyy HH:mm")}
                    {a.groupName ? ` · ${a.groupName}` : ""}
                  </span>
                  <span className="text-neutral-800">{formatActivity(a.type, a.metadata)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatActivity(type: string, metadata: unknown) {
  const m = metadata as Record<string, unknown> | null;
  switch (type) {
    case ACTIVITY_TYPES.EXPENSE_ADDED:
      return `Expense added: ${String(m?.description ?? "Expense")}`;
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
