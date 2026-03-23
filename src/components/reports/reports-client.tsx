"use client";

import * as React from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MemberDot } from "@/components/shared/member-avatar";
import { cn, formatCurrency } from "@/lib/utils";

type ReportPayload = NonNullable<Awaited<ReturnType<typeof import("@/actions/reports").getReportData>>>;

export function ReportsClient({ data }: { data: ReportPayload }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId") ?? "";
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  function applyGroupFilter(nextId: string) {
    const q = new URLSearchParams(searchParams.toString());
    if (nextId) q.set("groupId", nextId);
    else q.delete("groupId");
    router.push(`/reports?${q.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">Reports</h1>
          <p className="page-subheading">Filter and export your shared spending.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="space-y-1">
            <label className="text-[13px] font-medium text-neutral-600">Group</label>
            <Select
              value={groupId}
              onChange={(e) => applyGroupFilter(e.target.value)}
              className="min-w-[200px]"
            >
              <option value="">All groups</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <a
            href={`/api/reports/csv?groupId=${encodeURIComponent(groupId || "")}`}
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex gap-2")}
          >
            <Download className="h-4 w-4" />
            CSV
          </a>
          <a
            href={`/api/reports/pdf?groupId=${encodeURIComponent(groupId || "")}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex gap-2")}
          >
            <Download className="h-4 w-4" />
            PDF
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Total spend</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.summary.totalSpend.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Expenses</CardDescription>
            <CardTitle className="text-2xl">{data.summary.expenseCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>Groups</CardDescription>
            <CardTitle className="text-2xl">{data.summary.groupCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardDescription>People</CardDescription>
            <CardTitle className="text-2xl">{data.summary.peopleCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-3">
        {data.sections.map((section) => (
          <Card key={section.groupId} className="border-neutral-200 shadow-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left"
              onClick={() =>
                setOpen((o) => ({ ...o, [section.groupId]: !o[section.groupId] }))
              }
            >
              <div>
                <p className="font-semibold text-neutral-900">{section.name}</p>
                <p className="text-xs text-neutral-500">{section.currency}</p>
              </div>
              {open[section.groupId] ? (
                <ChevronDown className="h-5 w-5 text-neutral-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-neutral-500" />
              )}
            </button>
            {open[section.groupId] ? (
              <CardContent className="space-y-6 border-t border-neutral-200 pt-4">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-neutral-700">Expenses</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2 pr-2">Date</th>
                          <th className="py-2 pr-2">Description</th>
                          <th className="py-2 pr-2">Paid by</th>
                          <th className="py-2 pr-2">Amount</th>
                          <th className="py-2">Original</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.expenses.map((e) => (
                          <tr key={e.id} className="border-b border-neutral-100">
                            <td className="py-2 pr-2 text-neutral-600">
                              {format(new Date(e.date), "MMM d, yyyy")}
                            </td>
                            <td className="py-2 pr-2 text-neutral-800">{e.description}</td>
                            <td className="py-2 pr-2 text-neutral-600">{e.paidByName}</td>
                            <td className="py-2 pr-2">
                              <CurrencyDisplay amount={e.amount} currency={section.currency} />
                            </td>
                            <td className="py-2 text-xs text-neutral-500">
                              {e.originalAmount != null && e.originalCurrency
                                ? `${formatCurrency(e.originalAmount, e.originalCurrency)}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-neutral-700">Balances</h3>
                  <ul className="space-y-1 text-sm">
                    {section.balances.map((b) => {
                      const sem =
                        b.balance > 0 ? "positive" : b.balance < 0 ? "negative" : "zero";
                      return (
                        <li key={b.userId} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-neutral-700">
                            <MemberDot userId={b.userId} />
                            <span className="truncate">{b.name ?? b.email}</span>
                            {b.isYou ? (
                              <span className="shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                You
                              </span>
                            ) : null}
                          </span>
                          {b.isYou ? (
                            <CurrencyDisplay
                              amount={Math.abs(b.balance)}
                              currency={section.currency}
                              direction={b.balance >= 0 ? "owed-to-you" : "you-owe"}
                            />
                          ) : (
                            <CurrencyDisplay
                              signedAmount={b.balance}
                              currency={section.currency}
                              direction="neutral"
                              balanceSemantic={sem}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-neutral-700">Suggestions</h3>
                  {section.suggestions.length === 0 ? (
                    <p className="text-sm text-neutral-500">All settled.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-neutral-700">
                      {section.suggestions.map((s, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-x-1 gap-y-1">
                          <MemberDot userId={s.fromId} />
                          <span>{s.fromLabel}</span>
                          <span className="text-neutral-400">pays</span>
                          <MemberDot userId={s.toId} />
                          <span>{s.toLabel}</span>
                          <CurrencyDisplay amount={s.amount} currency={section.currency} className="ml-1" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-neutral-700">Settlements</h3>
                  {section.settlements.length === 0 ? (
                    <p className="text-sm text-neutral-500">None recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-neutral-600">
                      {section.settlements.map((s) => (
                        <li key={s.id}>
                          {format(new Date(s.settledAt), "MMM d, yyyy")} — {s.fromLabel} → {s.toLabel}{" "}
                          {formatCurrency(s.amount, section.currency)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link href={`/groups/${section.groupId}`} className="text-sm text-neutral-900 hover:underline">
                  Open group →
                </Link>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
