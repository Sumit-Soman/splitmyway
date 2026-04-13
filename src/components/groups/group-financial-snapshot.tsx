"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { MemberAvatar, MemberName } from "@/components/shared/member-avatar";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn, formatCurrency } from "@/lib/utils";

type SnapshotSuggestion = {
  fromId: string;
  toId: string;
  amount: number;
  fromName: string;
  toName: string;
};

type MemberRow = { userId: string; name: string | null; email: string; avatarUrl?: string | null };
type ExpenseRow = { paidById: string; amount: number };
type SettlementRow = { fromId: string; toId: string; amount: number };

const MANY_MEMBERS = 6;

export function GroupFinancialSnapshot({
  groupCurrency,
  currentUserId,
  members,
  expenses,
  settlements,
  balances,
  youPaySuggestions,
  youReceiveSuggestions,
}: {
  groupCurrency: string;
  currentUserId: string;
  members: MemberRow[];
  expenses: ExpenseRow[];
  settlements: SettlementRow[];
  balances: { userId: string; balance: number }[];
  youPaySuggestions: SnapshotSuggestion[];
  youReceiveSuggestions: SnapshotSuggestion[];
}) {
  const yourBalance = balances.find((b) => b.userId === currentUserId)?.balance ?? 0;

  const { totalShared, totalSettled, paidByMember } = useMemo(() => {
    let total = 0;
    const paid = new Map<string, number>();
    const sent = new Map<string, number>();
    const received = new Map<string, number>();
    for (const m of members) {
      paid.set(m.userId, 0);
      sent.set(m.userId, 0);
      received.set(m.userId, 0);
    }
    for (const e of expenses) {
      total += e.amount;
      paid.set(e.paidById, (paid.get(e.paidById) ?? 0) + e.amount);
    }
    let settledSum = 0;
    for (const s of settlements) {
      settledSum += s.amount;
      sent.set(s.fromId, (sent.get(s.fromId) ?? 0) + s.amount);
      received.set(s.toId, (received.get(s.toId) ?? 0) + s.amount);
    }
    const rows = members
      .map((m) => ({
        member: m,
        paid: paid.get(m.userId) ?? 0,
        settledSent: sent.get(m.userId) ?? 0,
        settledReceived: received.get(m.userId) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.paid - a.paid || (a.member.name ?? a.member.email).localeCompare(b.member.name ?? b.member.email)
      );
    return { totalShared: total, totalSettled: settledSum, paidByMember: rows };
  }, [members, expenses, settlements]);

  const hasExpenses = expenses.length > 0;
  const showFinances = hasExpenses || settlements.length > 0;
  const manyMembers = members.length >= MANY_MEMBERS;

  if (!showFinances) {
    return (
      <div className="w-full rounded-2xl border border-neutral-200/60 bg-neutral-50/40 px-5 py-6 sm:px-6">
        <p className="text-sm text-neutral-500">
          Add an expense or record a settlement to see balances, who paid what, and how to settle up.
        </p>
      </div>
    );
  }

  const netAbs = Math.abs(yourBalance);
  const even = netAbs < 0.005;
  const hasSuggestionLines = youPaySuggestions.length > 0 || youReceiveSuggestions.length > 0;

  return (
    <section
      aria-label="Group finances"
      className="w-full overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      {/* Header — like a simple app “screen title” */}
      <div className="border-b border-neutral-100 bg-gradient-to-b from-neutral-50/90 to-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Finances</p>
            <p className="mt-0.5 max-w-md text-xs leading-snug text-neutral-500">
              Your net balance in this group, who paid for shared expenses, and amounts recorded as settlements.
            </p>
          </div>
          <span className="rounded-full border border-neutral-200/80 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-neutral-500">
            {groupCurrency}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Left — “You” (Splitwise-style: me first) */}
        <div className="border-b border-neutral-100 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Your balance</p>
          {even ? (
            <p className="text-2xl font-semibold tracking-tight text-neutral-800">You&apos;re settled up</p>
          ) : yourBalance > 0 ? (
            <div className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-emerald-700">
                {formatCurrency(netAbs, groupCurrency)}
              </p>
              <p className="text-sm text-neutral-500">Net: others owe you (in this group)</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-rose-700">
                {formatCurrency(netAbs, groupCurrency)}
              </p>
              <p className="text-sm text-neutral-500">Net: you owe others (in this group)</p>
            </div>
          )}

          {hasSuggestionLines ? (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-medium text-neutral-400">Suggested payments to settle up</p>
              <ul className="flex flex-col gap-2" aria-label="Suggested settlement payments for you">
                {youPaySuggestions.map((s, i) => (
                  <li
                    key={`snap-pay-${s.toId}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5"
                  >
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-rose-500/90" strokeWidth={2} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-neutral-500">You owe</p>
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-neutral-800">
                        <MemberName userId={s.toId}>{s.toName}</MemberName>
                      </p>
                    </div>
                    <CurrencyDisplay
                      className="shrink-0 text-sm font-semibold"
                      amount={s.amount}
                      currency={groupCurrency}
                      direction="you-owe"
                    />
                  </li>
                ))}
                {youReceiveSuggestions.map((s, i) => (
                  <li
                    key={`snap-recv-${s.fromId}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5"
                  >
                    <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-600/90" strokeWidth={2} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-neutral-800">
                        <MemberName userId={s.fromId}>{s.fromName}</MemberName>
                      </p>
                      <p className="text-[11px] text-neutral-500">owes you</p>
                    </div>
                    <CurrencyDisplay
                      className="shrink-0 text-sm font-semibold"
                      amount={s.amount}
                      currency={groupCurrency}
                      direction="owed-to-you"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Right — group + members */}
        <div className="flex flex-col p-4 sm:p-6">
          <div className="mb-4 flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
              <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Group overview</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                Who paid for shared expenses, and how much each person paid out or took in through recorded
                settlements.
              </p>
            </div>
          </div>

          {/* Group totals — bill total + total “sent” in settlements (industry apps surface both) */}
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Group spend</p>
              <p className="mt-0.5 tabular-nums text-base font-semibold text-neutral-900">
                {formatCurrency(totalShared, groupCurrency)}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">Total of all expenses</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-violet-700/80">Total settled</p>
              <p className="mt-0.5 tabular-nums text-base font-semibold text-violet-900">
                {formatCurrency(totalSettled, groupCurrency)}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-violet-700/70">
                Sum of amounts in recorded settlement payments (all members)
              </p>
            </div>
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Payments</p>
              <p className="mt-0.5 text-base font-semibold text-neutral-900">
                {settlements.length === 0 ? "—" : settlements.length}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-neutral-400">Settlement records</p>
            </div>
          </div>

          <div
            className={cn(
              manyMembers && "max-h-[min(280px,45vh)] overflow-y-auto pr-1 [scrollbar-width:thin]"
            )}
          >
            <ul className="flex flex-col divide-y divide-neutral-100" aria-label="Members spending and settlements">
              {paidByMember.map(({ member, paid, settledSent, settledReceived }) => {
                const hasSett = settledSent > 0.004 || settledReceived > 0.004;
                const label = member.name?.trim() || member.email;
                return (
                  <li key={member.userId} className="flex flex-col gap-2 py-3 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <MemberAvatar
                          size="sm"
                          userId={member.userId}
                          name={member.name}
                          email={member.email}
                          avatarUrl={member.avatarUrl}
                        />
                        <span className="min-w-0 truncate" title={label}>
                          <MemberName userId={member.userId} className="text-sm font-medium text-neutral-900">
                            {label}
                          </MemberName>
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Paid for group</p>
                        <p className="tabular-nums text-sm font-semibold text-neutral-900">
                          {formatCurrency(paid, groupCurrency)}
                        </p>
                      </div>
                    </div>
                    {hasSett ? (
                      <div className="ml-0 flex flex-wrap gap-2 pl-0 sm:pl-11">
                        {settledSent > 0.004 ? (
                          <span
                            title="Amount this person paid to others in recorded settlements"
                            className={cn(
                              "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium tabular-nums",
                              "border-rose-100 bg-rose-50 text-rose-800"
                            )}
                          >
                            Paid out {formatCurrency(settledSent, groupCurrency)}
                          </span>
                        ) : null}
                        {settledReceived > 0.004 ? (
                          <span
                            title="Amount this person received from others in recorded settlements"
                            className={cn(
                              "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium tabular-nums",
                              "border-emerald-100 bg-emerald-50 text-emerald-800"
                            )}
                          >
                            Received {formatCurrency(settledReceived, groupCurrency)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          {manyMembers ? (
            <p className="mt-2 text-center text-[10px] text-neutral-400">Scroll the list to see everyone</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
