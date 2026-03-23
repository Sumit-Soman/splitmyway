"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn, formatCurrency } from "@/lib/utils";

type BalanceRow = { userId: string; name: string | null; email: string; balance: number };
type MemberLite = { userId: string; name: string | null; email: string; avatarUrl: string | null };
type Suggestion = {
  fromId: string;
  toId: string;
  amount: number;
  fromName: string;
  toName: string;
};

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("app-label-caps", className)}>{children}</p>;
}

/** Same currency string for every row; signed coloring for non-zero. */
function LedgerNetAmount({
  balance,
  currency,
  perspective,
}: {
  balance: number;
  currency: string;
  perspective: "self" | "peer";
}) {
  const n = Math.round(balance * 100) / 100;
  const settled = Math.abs(n) < 0.001;
  if (settled) {
    return (
      <span className="text-sm font-semibold tabular-nums tracking-tight text-neutral-500">{formatCurrency(0, currency)}</span>
    );
  }
  if (n > 0) {
    return (
      <span className="text-sm font-semibold tabular-nums tracking-tight text-emerald-700">
        +{formatCurrency(n, currency)}
      </span>
    );
  }
  const debtTone = perspective === "self" ? "text-rose-600" : "text-amber-800";
  return (
    <span className={cn("text-sm font-semibold tabular-nums tracking-tight", debtTone)}>
      −{formatCurrency(Math.abs(n), currency)}
    </span>
  );
}

function memberMeta(members: MemberLite[], userId: string) {
  return members.find((m) => m.userId === userId);
}

export function GroupBalancesExplainer({
  groupCurrency,
  currentUserId,
  members,
  balances,
  suggestions,
  onSettleSuggestion,
}: {
  groupCurrency: string;
  currentUserId: string;
  members: MemberLite[];
  balances: BalanceRow[];
  suggestions: Suggestion[];
  onSettleSuggestion: (s: { fromId: string; toId: string; amount: number }) => void;
}) {
  const myRow = useMemo(() => balances.find((b) => b.userId === currentUserId), [balances, currentUserId]);
  const myNet = myRow?.balance ?? 0;

  const youPay = useMemo(
    () => suggestions.filter((s) => s.fromId === currentUserId),
    [suggestions, currentUserId]
  );
  const youReceive = useMemo(
    () => suggestions.filter((s) => s.toId === currentUserId),
    [suggestions, currentUserId]
  );

  const netLabel =
    myNet > 0
      ? "The group owes you"
      : myNet < 0
        ? "You owe the group, net"
        : "You are even with the group";

  const netSubline =
    myNet > 0
      ? "After splitting all expenses and recorded settlements, others still need to cover your share."
      : myNet < 0
        ? "Your share of spending exceeds what others still owe you back in this group."
        : "No net balance to settle for you in this group.";

  return (
    <div className="space-y-6">
      {/* Executive summary */}
      <div className="app-panel">
        <div className="app-summary-row">
          <div className="min-w-0 space-y-1">
            <SectionLabel>Your net position</SectionLabel>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900">{netLabel}</h2>
            <p className="app-text-secondary max-w-xl">{netSubline}</p>
          </div>
          <div className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3 sm:mt-0 sm:border-t-0 sm:pt-0 sm:text-right">
            <SectionLabel className="sm:text-right">Amount</SectionLabel>
            <div>
              {myNet === 0 ? (
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-400">—</span>
              ) : (
                <CurrencyDisplay
                  className="text-2xl"
                  amount={Math.abs(myNet)}
                  currency={groupCurrency}
                  direction={myNet > 0 ? "owed-to-you" : "you-owe"}
                />
              )}
            </div>
            <p className="text-xs text-neutral-500 sm:text-right">{groupCurrency} · this group only</p>
          </div>
        </div>

        {/* You-centric flows */}
        <div className="app-flow-split">
          <div className="app-flow-split__col">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50">
                <ArrowUpRight className="h-3.5 w-3.5 text-rose-700" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <SectionLabel>Outgoing for you</SectionLabel>
                <p className="text-sm font-medium leading-snug text-neutral-900">Payments you should make</p>
              </div>
            </div>
            {youPay.length === 0 ? (
              <p className="text-sm leading-snug text-neutral-500">
                No suggested payments from you right now. You do not need to send money to settle this plan.
              </p>
            ) : (
              <ul className="space-y-3">
                {youPay.map((s, i) => (
                  <li
                    key={`pay-${s.toId}-${i}`}
                    className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      <MemberAvatar
                        userId={s.toId}
                        name={s.toName}
                        email={memberMeta(members, s.toId)?.email ?? ""}
                        avatarUrl={memberMeta(members, s.toId)?.avatarUrl}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm leading-snug text-neutral-900">
                          <span className="text-neutral-500">Pay </span>
                          <span className="font-semibold">{s.toName}</span>
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                          This transfer is one of the few moves needed so everyone ends at zero.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end sm:pt-0.5">
                      <CurrencyDisplay amount={s.amount} currency={groupCurrency} direction="you-owe" />
                      <Button type="button" size="sm" variant="outline" onClick={() => onSettleSuggestion(s)}>
                        Record payment
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="app-flow-split__col border-t border-neutral-100 sm:border-t-0">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50">
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-700" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <SectionLabel>Incoming for you</SectionLabel>
                <p className="text-sm font-medium leading-snug text-neutral-900">Payments you should receive</p>
              </div>
            </div>
            {youReceive.length === 0 ? (
              <p className="text-sm leading-snug text-neutral-500">
                No one is slated to pay you in this settlement plan. If your net above is positive, it may be
                offset by how debts were consolidated across members.
              </p>
            ) : (
              <ul className="space-y-3">
                {youReceive.map((s, i) => (
                  <li
                    key={`recv-${s.fromId}-${i}`}
                    className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      <MemberAvatar
                        userId={s.fromId}
                        name={s.fromName}
                        email={memberMeta(members, s.fromId)?.email ?? ""}
                        avatarUrl={memberMeta(members, s.fromId)?.avatarUrl}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm leading-snug text-neutral-900">
                          <span className="text-neutral-500">Receive from </span>
                          <span className="font-semibold">{s.fromName}</span>
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                          When they pay you this amount, your shared balance moves toward settled.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end sm:pt-0.5">
                      <CurrencyDisplay amount={s.amount} currency={groupCurrency} direction="owed-to-you" />
                      <Button type="button" size="sm" variant="outline" onClick={() => onSettleSuggestion(s)}>
                        Record payment
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="app-footnote-row">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <p className="text-xs leading-snug text-neutral-600">
            <span className="font-medium text-neutral-800">How this works:</span> We compute each person&apos;s net
            balance from expenses and settlements, then suggest the smallest set of payments so all nets go to
            zero. Your &ldquo;outgoing&rdquo; and &ldquo;incoming&rdquo; lists are only the lines where you appear.
          </p>
        </div>
      </div>

      {/* Full plan */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Full settlement plan</CardTitle>
          <CardDescription>
            Every suggested transfer in this group. Recording these (or equivalent partial payments) clears the
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-sm text-neutral-500">All balances in this group are already at zero.</p>
          ) : (
            suggestions.map((s, i) => (
              <div
                key={`all-${i}`}
                className="flex flex-col gap-2 rounded-md border border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-800">
                  <MemberAvatar
                    userId={s.fromId}
                    name={s.fromName}
                    email={memberMeta(members, s.fromId)?.email ?? ""}
                    avatarUrl={memberMeta(members, s.fromId)?.avatarUrl}
                    size="sm"
                    className="shrink-0"
                  />
                  <span className="font-medium">{s.fromName}</span>
                  <span className="text-neutral-400">pays</span>
                  <MemberAvatar
                    userId={s.toId}
                    name={s.toName}
                    email={memberMeta(members, s.toId)?.email ?? ""}
                    avatarUrl={memberMeta(members, s.toId)?.avatarUrl}
                    size="sm"
                    className="shrink-0"
                  />
                  <span className="font-medium">{s.toName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm tabular-nums text-neutral-700">{formatCurrency(s.amount, groupCurrency)}</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onSettleSuggestion(s)}>
                    Record
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Member ledger</CardTitle>
          <CardDescription>
            Each person&apos;s net in {groupCurrency}. Positive = the group still owes them; negative = they still
            owe the group. Your row uses color to show owe vs owed.
          </CardDescription>
        </CardHeader>
        <CardContent className="rounded-md border border-neutral-100 p-0">
          <div className="divide-y divide-neutral-100">
          {balances.map((b) => {
            const isYou = b.userId === currentUserId;
            return (
              <div
                key={b.userId}
                className={cn(
                  "grid grid-cols-1 items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,auto)] sm:gap-4 sm:px-4 sm:py-2.5",
                  isYou && "bg-neutral-50/90"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <MemberAvatar
                    userId={b.userId}
                    name={b.name}
                    email={b.email}
                    avatarUrl={memberMeta(members, b.userId)?.avatarUrl}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <p className="truncate text-sm font-semibold leading-snug text-neutral-900">{b.name ?? b.email}</p>
                      {isYou ? (
                        <span className="inline-flex shrink-0 items-center rounded border border-neutral-800 bg-neutral-900 px-1.5 py-px text-[10px] font-semibold uppercase leading-none tracking-wide text-white">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-neutral-500">
                      {isYou
                        ? myNet > 0
                          ? "Net: group owes you"
                          : myNet < 0
                            ? "Net: you owe the group"
                            : "Net: even"
                        : b.balance > 0
                          ? "Net creditor in this group"
                          : b.balance < 0
                            ? "Net debtor in this group"
                            : "Net: even"}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex w-full items-center justify-end rounded-md border border-neutral-200/80 bg-white px-2.5 py-1.5 sm:w-auto sm:min-w-[9.5rem]"
                  )}
                >
                  <LedgerNetAmount
                    balance={b.balance}
                    currency={groupCurrency}
                    perspective={isYou ? "self" : "peer"}
                  />
                </div>
              </div>
            );
          })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
