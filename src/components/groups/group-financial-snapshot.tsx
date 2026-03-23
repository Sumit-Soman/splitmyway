"use client";

import { useMemo } from "react";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatCurrency } from "@/lib/utils";

type Suggestion = {
  fromId: string;
  toId: string;
  amount: number;
  fromName: string;
  toName: string;
};

type MemberRow = { userId: string; name: string | null; email: string; avatarUrl?: string | null };
type ExpenseRow = { paidById: string; amount: number };
type SettlementRow = { fromId: string; toId: string; amount: number };

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
  youPaySuggestions: Suggestion[];
  youReceiveSuggestions: Suggestion[];
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

  if (!hasExpenses) {
    return (
      <div className="max-w-4xl rounded-2xl border border-neutral-200/60 bg-neutral-50/40 px-5 py-6 sm:px-6">
        <p className="text-sm text-neutral-500">
          Add an expense to see balances, who paid what, settlements, and how to settle up.
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
      className="max-w-4xl rounded-2xl border border-neutral-200/70 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6"
    >
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">Finances</h2>
        <span className="font-mono text-xs text-neutral-400">{groupCurrency}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-4">
          {even ? (
            <p className="text-2xl font-semibold tracking-tight text-neutral-800">You&apos;re even</p>
          ) : yourBalance > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-emerald-800">
                {formatCurrency(netAbs, groupCurrency)}
              </span>
              <span className="text-sm text-neutral-500">owed to you</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-rose-800">
                {formatCurrency(netAbs, groupCurrency)}
              </span>
              <span className="text-sm text-neutral-500">you owe</span>
            </div>
          )}

          {hasSuggestionLines ? (
            <ul className="flex flex-col gap-1.5" aria-label="Payments involving you">
              {youPaySuggestions.map((s, i) => (
                <li
                  key={`snap-pay-${s.toId}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-rose-500/[0.07] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[13px] text-neutral-700">
                    → <span className="font-medium text-neutral-900">{s.toName}</span>
                  </span>
                  <CurrencyDisplay
                    className="shrink-0 text-[13px] font-semibold"
                    amount={s.amount}
                    currency={groupCurrency}
                    direction="you-owe"
                  />
                </li>
              ))}
              {youReceiveSuggestions.map((s, i) => (
                <li
                  key={`snap-recv-${s.fromId}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-emerald-500/[0.08] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[13px] text-neutral-700">
                    ← <span className="font-medium text-neutral-900">{s.fromName}</span>
                  </span>
                  <CurrencyDisplay
                    className="shrink-0 text-[13px] font-semibold"
                    amount={s.amount}
                    currency={groupCurrency}
                    direction="owed-to-you"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="lg:border-l lg:border-neutral-100 lg:pl-10">
          <p className="mb-3 text-xs font-medium text-neutral-400">Paid out (who covered bills)</p>
          <ul className="flex flex-col gap-2" aria-label="Total paid per member">
            {paidByMember.map(({ member, paid, settledSent, settledReceived }) => {
              const hasSett =
                settledSent > 0.004 || settledReceived > 0.004;
              return (
                <li key={member.userId} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar
                      size="sm"
                      userId={member.userId}
                      name={member.name}
                      email={member.email}
                      avatarUrl={member.avatarUrl}
                    />
                    <span className="truncate text-sm text-neutral-800">{member.name ?? member.email}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block tabular-nums text-sm font-medium text-neutral-900">
                      {formatCurrency(paid, groupCurrency)}
                    </span>
                    {hasSett ? (
                      <span className="mt-0.5 block text-[11px] tabular-nums text-neutral-400">
                        {settledSent > 0.004 ? `−${formatCurrency(settledSent, groupCurrency)} sent` : null}
                        {settledSent > 0.004 && settledReceived > 0.004 ? " · " : null}
                        {settledReceived > 0.004 ? `+${formatCurrency(settledReceived, groupCurrency)} recv` : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-neutral-400">
            <span className="tabular-nums text-neutral-600">{formatCurrency(totalShared, groupCurrency)}</span>{" "}
            expenses ·{" "}
            <span className="tabular-nums text-neutral-600">{formatCurrency(totalSettled, groupCurrency)}</span>{" "}
            settled
            {settlements.length > 0 ? (
              <>
                {" "}
                · {settlements.length} {settlements.length === 1 ? "payment" : "payments"}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
}
