"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { createExpense, deleteExpense } from "@/actions/expenses";
import { addMemberToGroup, deleteGroup, removeMemberFromGroup } from "@/actions/groups";
import { createSettlement } from "@/actions/settlements";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MemberAvatar, MemberDot } from "@/components/shared/member-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { getMemberPalette } from "@/lib/member-colors";
import { cn, formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORIES, GROUP_CATEGORIES, SPLIT_METHODS, CURRENCIES } from "@/lib/constants";
import { calculateSplit } from "@/lib/calculations/splits";
import { useToast } from "@/components/ui/toast";

import type { GroupDetailSerialized } from "@/actions/group-detail";

export function GroupDetailClient({ data }: { data: GroupDetailSerialized }) {
  const router = useRouter();
  const { toast } = useToast();
  const { group, members, expenses, balances, suggestions, settlements, role, currentUserId, invitations } = data;
  const isAdmin = role === "admin";

  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [splitMethod, setSplitMethod] = useState<"equal" | "exact" | "percentage" | "shares">("equal");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [expenseCurrency, setExpenseCurrency] = useState(group.currency);
  const [ratePreview, setRatePreview] = useState<{ rate: number; converted: number } | null>(null);
  const [amountStr, setAmountStr] = useState("");

  const [exactMap, setExactMap] = useState<Record<string, string>>({});
  const [pctMap, setPctMap] = useState<Record<string, string>>({});
  const [shareMap, setShareMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelected(new Set(members.map((m) => m.userId)));
  }, [members]);

  const amountNum = parseFloat(amountStr) || 0;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!amountNum || expenseCurrency === group.currency) {
        setRatePreview(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/exchange-rate?from=${encodeURIComponent(expenseCurrency)}&to=${encodeURIComponent(group.currency)}`
        );
        const j = (await res.json()) as { rate?: number };
        if (cancelled || !j.rate) return;
        setRatePreview({ rate: j.rate, converted: Math.round(amountNum * j.rate * 100) / 100 });
      } catch {
        setRatePreview(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [amountNum, expenseCurrency, group.currency]);

  const participantIds = useMemo(() => Array.from(selected), [selected]);

  const previewSplit = useMemo(() => {
    const total =
      expenseCurrency !== group.currency && ratePreview
        ? ratePreview.converted
        : amountNum;
    if (!total || participantIds.length === 0) return null;
    return calculateSplit({
      method: splitMethod,
      totalAmount: total,
      participantIds,
      exactAmounts: Object.fromEntries(
        Object.entries(exactMap).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
      percentages: Object.fromEntries(
        Object.entries(pctMap).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
      shares: Object.fromEntries(
        Object.entries(shareMap).map(([k, v]) => [k, parseInt(v, 10) || 1])
      ),
    });
  }, [amountNum, expenseCurrency, group.currency, ratePreview, participantIds, splitMethod, exactMap, pctMap, shareMap]);

  const [expenseState, expenseAction, expensePending] = useActionState(
    async (_p: ActionResult | null, formData: FormData) => createExpense(_p, formData),
    null
  );

  useEffect(() => {
    if (expenseState?.success) {
      toast({ title: "Expense added" });
      setAddOpen(false);
      router.refresh();
    } else if (expenseState && !expenseState.success) {
      toast({ title: "Could not add expense", description: expenseState.error, variant: "destructive" });
    }
  }, [expenseState, router, toast]);

  const [memberState, memberAction, memberPending] = useActionState(
    async (_p: ActionResult | null, formData: FormData) => addMemberToGroup(_p, formData),
    null
  );

  useEffect(() => {
    if (memberState?.success) {
      toast({ title: memberState.message ?? "Done" });
      router.refresh();
    } else if (memberState && !memberState.success) {
      toast({ title: "Error", description: memberState.error, variant: "destructive" });
    }
  }, [memberState, router, toast]);

  const [settleState, settleAction, settlePending] = useActionState(
    async (_p: ActionResult | null, formData: FormData) => createSettlement(_p, formData),
    null
  );

  useEffect(() => {
    if (settleState?.success) {
      toast({ title: "Settlement recorded" });
      setSettleOpen(false);
      router.refresh();
    } else if (settleState && !settleState.success) {
      toast({ title: "Error", description: settleState.error, variant: "destructive" });
    }
  }, [settleState, router, toast]);

  const [confirmExpenseId, setConfirmExpenseId] = useState<string | null>(null);
  const [confirmMemberId, setConfirmMemberId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-heading">{group.name}</h1>
            <Badge variant="outline">{GROUP_CATEGORIES.find((c) => c.value === group.category)?.label ?? group.category}</Badge>
            <Badge variant="secondary">{group.currency}</Badge>
          </div>
          {group.description ? <p className="page-subheading">{group.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
            <DialogContent title="Add expense" className="max-w-lg">
                <form action={expenseAction} className="space-y-4">
                  <input type="hidden" name="groupId" value={group.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Input id="description" name="description" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        id="currency"
                        name="currency"
                        value={expenseCurrency}
                        onChange={(e) => setExpenseCurrency(e.target.value)}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {expenseCurrency !== group.currency && ratePreview ? (
                      <div className="sm:col-span-2 rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-800">
                        Live rate: 1 {expenseCurrency} = {ratePreview.rate.toFixed(6)} {group.currency}. Converted:{" "}
                        <strong>{formatCurrency(ratePreview.converted, group.currency)}</strong>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select id="category" name="category" defaultValue="general">
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" name="date" type="datetime-local" defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="paidById">Paid by</Label>
                      <Select id="paidById" name="paidById" defaultValue={currentUserId}>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name ?? m.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" name="notes" rows={2} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Split method</Label>
                      <Select
                        name="splitMethod"
                        value={splitMethod}
                        onChange={(e) => setSplitMethod(e.target.value as typeof splitMethod)}
                      >
                        {SPLIT_METHODS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Participants</Label>
                    <div className="grid gap-2">
                      {members.map((m) => (
                        <label key={m.userId} className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={selected.has(m.userId)}
                            onChange={() => {
                              setSelected((prev) => {
                                const n = new Set(prev);
                                if (n.has(m.userId)) n.delete(m.userId);
                                else n.add(m.userId);
                                return n;
                              });
                            }}
                          />
                          <MemberDot userId={m.userId} />
                          {m.name ?? m.email}
                        </label>
                      ))}
                    </div>
                    {participantIds.map((id) => (
                      <input key={id} type="hidden" name="participantIds" value={id} />
                    ))}
                  </div>

                  {splitMethod === "exact" ? (
                    <div className="space-y-2">
                      {participantIds.map((id) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="flex w-36 min-w-0 items-center gap-1.5 truncate text-xs text-neutral-600">
                            <MemberDot userId={id} />
                            {members.find((x) => x.userId === id)?.name ?? id}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={exactMap[id] ?? ""}
                            onChange={(e) => setExactMap((p) => ({ ...p, [id]: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                      ))}
                      <input
                        type="hidden"
                        name="exactAmounts"
                        value={JSON.stringify(
                          Object.fromEntries(
                            participantIds.map((id) => [id, parseFloat(exactMap[id] ?? "0") || 0])
                          )
                        )}
                      />
                    </div>
                  ) : null}

                  {splitMethod === "percentage" ? (
                    <div className="space-y-2">
                      {participantIds.map((id) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="flex w-36 min-w-0 items-center gap-1.5 truncate text-xs text-neutral-600">
                            <MemberDot userId={id} />
                            {members.find((x) => x.userId === id)?.name ?? id}
                          </span>
                          <Input
                            type="number"
                            step="0.1"
                            value={pctMap[id] ?? ""}
                            onChange={(e) => setPctMap((p) => ({ ...p, [id]: e.target.value }))}
                            placeholder="%"
                          />
                        </div>
                      ))}
                      <input
                        type="hidden"
                        name="percentages"
                        value={JSON.stringify(
                          Object.fromEntries(
                            participantIds.map((id) => [id, parseFloat(pctMap[id] ?? "0") || 0])
                          )
                        )}
                      />
                    </div>
                  ) : null}

                  {splitMethod === "shares" ? (
                    <div className="space-y-2">
                      {participantIds.map((id) => (
                        <div key={id} className="flex items-center gap-2">
                          <span className="flex w-36 min-w-0 items-center gap-1.5 truncate text-xs text-neutral-600">
                            <MemberDot userId={id} />
                            {members.find((x) => x.userId === id)?.name ?? id}
                          </span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={shareMap[id] ?? "1"}
                            onChange={(e) => setShareMap((p) => ({ ...p, [id]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <input
                        type="hidden"
                        name="shares"
                        value={JSON.stringify(
                          Object.fromEntries(
                            participantIds.map((id) => [id, parseInt(shareMap[id] ?? "1", 10) || 1])
                          )
                        )}
                      />
                    </div>
                  ) : null}

                  {previewSplit && previewSplit.ok ? (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                      <p className="mb-2 font-medium text-neutral-700">Split preview ({group.currency})</p>
                      <ul className="space-y-1">
                        {Object.entries(previewSplit.amounts).map(([uid, amt]) => (
                          <li key={uid} className="flex justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <MemberDot userId={uid} />
                              {members.find((x) => x.userId === uid)?.name ?? uid}
                            </span>
                            <span className="tabular-nums text-neutral-900">{formatCurrency(amt, group.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : previewSplit && !previewSplit.ok ? (
                    <p className="text-sm text-red-600">{previewSplit.error}</p>
                  ) : null}

                  <Button type="submit" disabled={expensePending || participantIds.length === 0}>
                    {expensePending ? "Saving…" : "Save expense"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            {isAdmin ? (
              <Button variant="outline" onClick={() => setConfirmDeleteGroup(true)} aria-label="Delete group">
                <MoreVertical className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" description="Add your first shared expense to get started." />
          ) : (
            <div className="space-y-3">
              {expenses.map((e) => (
                <Card key={e.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <MemberAvatar userId={e.paidBy.id} name={e.paidBy.name} email={e.paidBy.email} />
                      <div>
                        <p className="font-medium text-neutral-900">{e.description}</p>
                        <p className="text-xs text-neutral-500">
                          {format(new Date(e.date), "MMM d, yyyy")} · Paid by {e.paidBy.name ?? e.paidBy.email} ·{" "}
                          {SPLIT_METHODS.find((s) => s.value === e.splitMethod)?.label ?? e.splitMethod}
                        </p>
                        {e.originalCurrency && e.originalCurrency !== e.currency && e.originalAmount != null ? (
                          <p className="mt-1 text-xs text-neutral-700">
                            Original: {formatCurrency(e.originalAmount, e.originalCurrency)} @ rate {e.exchangeRate}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <CurrencyDisplay amount={e.amount} currency={e.currency} />
                        {e.originalCurrency && e.originalCurrency !== e.currency && e.originalAmount != null ? (
                          <p className="text-xs text-neutral-500">
                            ({formatCurrency(e.originalAmount, e.originalCurrency)})
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete expense"
                        onClick={() => setConfirmExpenseId(e.id)}
                      >
                        <Trash2 className="h-4 w-4 text-neutral-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Member balances</CardTitle>
                <CardDescription>Positive means the group owes them; negative means they owe the group.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {balances.map((b) => {
                  const pal = getMemberPalette(b.userId);
                  const sem =
                    b.balance > 0 ? "positive" : b.balance < 0 ? "negative" : ("zero" as const);
                  return (
                    <div
                      key={b.userId}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md border border-neutral-100 py-2.5 pl-3 pr-2 text-sm",
                        pal.border,
                        pal.rowBg
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-neutral-800">
                        <MemberDot userId={b.userId} />
                        <span className="truncate font-medium">{b.name ?? b.email}</span>
                        {b.userId === currentUserId ? (
                          <span className="shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            You
                          </span>
                        ) : null}
                      </span>
                      {b.userId === currentUserId ? (
                        <CurrencyDisplay
                          amount={Math.abs(b.balance)}
                          currency={group.currency}
                          direction={b.balance >= 0 ? "owed-to-you" : "you-owe"}
                        />
                      ) : (
                        <CurrencyDisplay
                          signedAmount={b.balance}
                          currency={group.currency}
                          direction="neutral"
                          balanceSemantic={sem}
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Settle up</CardTitle>
                <CardDescription>Minimum transactions to clear balances.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestions.length === 0 ? (
                  <p className="text-sm text-neutral-500">All settled in this group.</p>
                ) : (
                  suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-neutral-700">
                        <MemberDot userId={s.fromId} />
                        <span className="font-medium">{s.fromName}</span>
                        <span className="text-neutral-400">pays</span>
                        <MemberDot userId={s.toId} />
                        <span className="font-medium">{s.toName}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <CurrencyDisplay amount={s.amount} currency={group.currency} />
                        <Button type="button" size="sm" onClick={() => setSettleOpen(true)}>
                          Settle
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              {invitations.length > 0 ? (
                <CardDescription>
                  Pending invitations: {invitations.map((i) => i.email).filter(Boolean).join(", ")}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
              {isAdmin ? (
                <form action={memberAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="groupId" value={group.id} />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="email">Add by email</Label>
                    <Input id="email" name="email" type="email" placeholder="friend@email.com" required />
                  </div>
                  <Button type="submit" disabled={memberPending}>
                    Add
                  </Button>
                </form>
              ) : null}
              <Separator />
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2",
                      getMemberPalette(m.userId).rowBg
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MemberAvatar userId={m.userId} name={m.name} email={m.email} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{m.name ?? m.email}</p>
                        <p className="text-xs text-neutral-500">{m.role}</p>
                      </div>
                    </div>
                    {isAdmin && m.userId !== currentUserId ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmMemberId(m.userId)}>
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <div className="mb-4 flex justify-end">
            <Button type="button" onClick={() => setSettleOpen(true)}>
              Record settlement
            </Button>
          </div>
          {settlements.length === 0 ? (
            <EmptyState title="No settlements recorded" />
          ) : (
            <div className="space-y-2">
              {settlements.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 text-sm">
                    <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-neutral-700">
                      <MemberDot userId={s.fromId} />
                      <span className="font-medium">{s.from.name ?? s.from.email}</span>
                      <span className="text-neutral-400">→</span>
                      <MemberDot userId={s.toId} />
                      <span className="font-medium">{s.to.name ?? s.to.email}</span>
                    </p>
                    <p className="mt-1 text-neutral-500">{format(new Date(s.settledAt), "MMM d, yyyy HH:mm")}</p>
                    <CurrencyDisplay className="mt-2" amount={s.amount} currency={s.currency} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent title="Record settlement">
          <form action={settleAction} className="space-y-3">
            <input type="hidden" name="groupId" value={group.id} />
            <div className="space-y-2">
              <Label>From</Label>
              <Select
                name="fromId"
                defaultValue={
                  suggestions[0]?.fromId ??
                  members[0]?.userId ??
                  ""
                }
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Select
                name="toId"
                defaultValue={
                  suggestions[0]?.toId ??
                  members.find((m) => m.userId !== members[0]?.userId)?.userId ??
                  members[0]?.userId ??
                  ""
                }
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="samount">Amount ({group.currency})</Label>
              <Input id="samount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snotes">Notes</Label>
              <Textarea id="snotes" name="notes" rows={2} />
            </div>
            <Button type="submit" disabled={settlePending}>
              {settlePending ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmExpenseId}
        onOpenChange={(o) => !o && setConfirmExpenseId(null)}
        title="Delete expense?"
        description="This cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        loading={busy}
        onConfirm={async () => {
          if (!confirmExpenseId) return;
          setBusy(true);
          try {
            const r = await deleteExpense(confirmExpenseId);
            if (!r.success) toast({ title: r.error, variant: "destructive" });
            else {
              toast({ title: "Expense deleted" });
              setConfirmExpenseId(null);
              router.refresh();
            }
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmMemberId}
        onOpenChange={(o) => !o && setConfirmMemberId(null)}
        title="Remove member?"
        description="They will lose access to this group."
        variant="warning"
        confirmLabel="Remove"
        loading={busy}
        onConfirm={async () => {
          if (!confirmMemberId) return;
          setBusy(true);
          try {
            const r = await removeMemberFromGroup(group.id, confirmMemberId);
            if (!r.success) toast({ title: r.error, variant: "destructive" });
            else {
              toast({ title: "Member removed" });
              setConfirmMemberId(null);
              router.refresh();
            }
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirmDeleteGroup}
        onOpenChange={setConfirmDeleteGroup}
        title="Delete group?"
        description="All expenses and settlements in this group will be permanently deleted."
        variant="danger"
        confirmLabel="Delete group"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const r = await deleteGroup(group.id);
            if (!r.success) toast({ title: r.error, variant: "destructive" });
            else {
              toast({ title: "Group deleted" });
              router.push("/groups");
            }
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
