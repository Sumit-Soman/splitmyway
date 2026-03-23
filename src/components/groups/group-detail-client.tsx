"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowRight, ArrowRightLeft, MoreVertical, Pencil, Plus, Trash2, Users } from "lucide-react";
import { createExpense, deleteExpense, updateExpense } from "@/actions/expenses";
import { addMemberToGroup, deleteGroup, removeMemberFromGroup } from "@/actions/groups";
import { createSettlement } from "@/actions/settlements";
import type { ActionResult } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { MemberAvatar, MemberDot, MemberName } from "@/components/shared/member-avatar";
import {
  ExpenseCategoryIcon,
  expenseCategoryChipClass,
  expenseCategoryLabel,
} from "@/lib/expense-category-icons";
import { EmptyState } from "@/components/shared/empty-state";
import { GroupBalancesExplainer } from "@/components/groups/group-balances-explainer";
import { GroupFinancialSnapshot } from "@/components/groups/group-financial-snapshot";
import { AddMemberPicker } from "@/components/groups/add-member-picker";
import { ExpenseDialogForm } from "@/components/groups/expense-dialog-form";
import { getMemberPalette } from "@/lib/member-colors";
import { cn, formatCurrency } from "@/lib/utils";
import { GROUP_CATEGORIES, SPLIT_METHODS } from "@/lib/constants";
import { calculateSplit } from "@/lib/calculations/splits";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { GroupDetailSerialized } from "@/actions/group-detail";

/** Shared style for category / currency / member meta on the group header. */
const groupHeaderMetaClass =
  "h-7 shrink-0 gap-1.5 border-neutral-200/90 bg-neutral-50/90 py-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export function GroupDetailClient({ data }: { data: GroupDetailSerialized }) {
  const router = useRouter();
  const { toast } = useToast();
  const { group, members, expenses, balances, suggestions, settlements, role, currentUserId, invitations } = data;
  const isAdmin = role === "admin";

  /** Remount settlement form when server data changes so default From/To/Amount stay in sync after refresh. */
  const settleFormDataKey = useMemo(
    () =>
      `${settlements.length}:${suggestions.map((s) => `${s.fromId}-${s.toId}-${s.amount}`).join("|")}`,
    [settlements, suggestions]
  );

  /** Minimized settlement edges involving the current user (same semantics as Balances tab). */
  const youPaySuggestions = useMemo(
    () => suggestions.filter((s) => s.fromId === currentUserId),
    [suggestions, currentUserId]
  );
  const youReceiveSuggestions = useMemo(
    () => suggestions.filter((s) => s.toId === currentUserId),
    [suggestions, currentUserId]
  );

  type GroupTab = "expenses" | "balances" | "members" | "settlements";
  const [groupTab, setGroupTab] = useState<GroupTab>("expenses");

  useEffect(() => {
    setGroupTab("expenses");
  }, [group.id]);

  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settlePreset, setSettlePreset] = useState<{
    fromId: string;
    toId: string;
    amount: string;
  } | null>(null);
  const [splitMethod, setSplitMethod] = useState<"equal" | "exact" | "percentage" | "shares">("equal");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [expenseCurrency, setExpenseCurrency] = useState(group.currency);
  const [ratePreview, setRatePreview] = useState<{ rate: number; converted: number } | null>(null);
  const [amountStr, setAmountStr] = useState("");

  const [exactMap, setExactMap] = useState<Record<string, string>>({});
  const [pctMap, setPctMap] = useState<Record<string, string>>({});
  const [shareMap, setShareMap] = useState<Record<string, string>>({});

  const [editingExpense, setEditingExpense] = useState<GroupDetailSerialized["expenses"][number] | null>(null);
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editExpenseCurrency, setEditExpenseCurrency] = useState(group.currency);
  const [editRatePreview, setEditRatePreview] = useState<{ rate: number; converted: number } | null>(null);
  const [editSplitMethod, setEditSplitMethod] = useState<"equal" | "exact" | "percentage" | "shares">("equal");
  const [editSelected, setEditSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [editExactMap, setEditExactMap] = useState<Record<string, string>>({});
  const [editPctMap, setEditPctMap] = useState<Record<string, string>>({});
  const [editShareMap, setEditShareMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelected(new Set(members.map((m) => m.userId)));
  }, [members]);

  useEffect(() => {
    setEditingExpense(null);
  }, [group.id]);

  useEffect(() => {
    if (!editingExpense) return;
    const e = editingExpense;
    if (e.originalAmount != null && e.originalCurrency) {
      setEditAmountStr(e.originalAmount.toFixed(2));
      setEditExpenseCurrency(e.originalCurrency);
    } else {
      setEditAmountStr(e.amount.toFixed(2));
      setEditExpenseCurrency(e.currency);
    }
    setEditSplitMethod(e.splitMethod as "equal" | "exact" | "percentage" | "shares");
    setEditSelected(new Set(e.participants.map((p) => p.userId)));
    const em: Record<string, string> = {};
    const pm: Record<string, string> = {};
    const sm: Record<string, string> = {};
    for (const p of e.participants) {
      if (e.splitMethod === "exact") em[p.userId] = p.amount.toFixed(2);
      if (e.splitMethod === "percentage" && p.percentage != null) pm[p.userId] = p.percentage.toFixed(1);
      if (e.splitMethod === "shares" && p.shares != null) sm[p.userId] = String(p.shares);
    }
    setEditExactMap(em);
    setEditPctMap(pm);
    setEditShareMap(sm);
  }, [editingExpense]);

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

  const editAmountNum = parseFloat(editAmountStr) || 0;
  const editParticipantIds = useMemo(() => Array.from(editSelected), [editSelected]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!editingExpense || !editAmountNum || editExpenseCurrency === group.currency) {
        setEditRatePreview(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/exchange-rate?from=${encodeURIComponent(editExpenseCurrency)}&to=${encodeURIComponent(group.currency)}`
        );
        const j = (await res.json()) as { rate?: number };
        if (cancelled || !j.rate) return;
        setEditRatePreview({ rate: j.rate, converted: Math.round(editAmountNum * j.rate * 100) / 100 });
      } catch {
        setEditRatePreview(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [editingExpense, editAmountNum, editExpenseCurrency, group.currency]);

  const editPreviewSplit = useMemo(() => {
    const total =
      editExpenseCurrency !== group.currency && editRatePreview
        ? editRatePreview.converted
        : editAmountNum;
    if (!total || editParticipantIds.length === 0) return null;
    return calculateSplit({
      method: editSplitMethod,
      totalAmount: total,
      participantIds: editParticipantIds,
      exactAmounts: Object.fromEntries(
        Object.entries(editExactMap).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
      percentages: Object.fromEntries(
        Object.entries(editPctMap).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
      shares: Object.fromEntries(
        Object.entries(editShareMap).map(([k, v]) => [k, parseInt(v, 10) || 1])
      ),
    });
  }, [
    editAmountNum,
    editExpenseCurrency,
    group.currency,
    editRatePreview,
    editParticipantIds,
    editSplitMethod,
    editExactMap,
    editPctMap,
    editShareMap,
  ]);

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

  const [updateExpenseState, updateExpenseAction, updateExpensePending] = useActionState(
    async (_p: ActionResult | null, formData: FormData) => updateExpense(_p, formData),
    null
  );

  useEffect(() => {
    if (updateExpenseState?.success) {
      toast({ title: "Expense updated" });
      setEditingExpense(null);
      router.refresh();
    } else if (updateExpenseState && !updateExpenseState.success) {
      toast({
        title: "Could not update expense",
        description: updateExpenseState.error,
        variant: "destructive",
      });
    }
  }, [updateExpenseState, router, toast]);

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
      toast({ title: "Settlement recorded", description: "Refreshing balances…" });
      void (async () => {
        await router.refresh();
        setSettleOpen(false);
        setSettlePreset(null);
      })();
    } else if (settleState && !settleState.success) {
      toast({ title: "Error", description: settleState.error, variant: "destructive" });
    }
  }, [settleState, router, toast]);

  const [confirmExpenseId, setConfirmExpenseId] = useState<string | null>(null);
  const [confirmMemberId, setConfirmMemberId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-neutral-100 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 space-y-2.5">
          <h1 className="page-heading break-words text-balance">{group.name}</h1>
          <div
            className="flex flex-wrap items-center gap-2"
            role="list"
            aria-label="Group category, currency, and size"
          >
            <Badge variant="outline" className={cn(groupHeaderMetaClass)} role="listitem">
              {GROUP_CATEGORIES.find((c) => c.value === group.category)?.label ?? group.category}
            </Badge>
            <Badge variant="outline" className={cn(groupHeaderMetaClass, "font-mono tracking-normal")} role="listitem">
              {group.currency}
            </Badge>
            <Badge variant="outline" className={cn(groupHeaderMetaClass)} role="listitem">
              <Users className="h-3.5 w-3.5 opacity-60" strokeWidth={2} aria-hidden />
              {members.length} {members.length === 1 ? "member" : "members"}
            </Badge>
          </div>
          {group.description ? (
            <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">{group.description}</p>
          ) : null}
          <GroupFinancialSnapshot
            groupCurrency={group.currency}
            currentUserId={currentUserId}
            members={members}
            expenses={expenses}
            settlements={settlements.map((s) => ({ fromId: s.fromId, toId: s.toId, amount: s.amount }))}
            balances={balances}
            youPaySuggestions={youPaySuggestions}
            youReceiveSuggestions={youReceiveSuggestions}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end sm:pt-0.5">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <Button data-testid="e2e-open-add-expense" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
            <DialogContent title="Add expense" className="max-w-lg">
              <form action={expenseAction} className="space-y-4">
                <ExpenseDialogForm
                  formKey={`add-${group.id}`}
                  groupId={group.id}
                  groupCurrency={group.currency}
                  currentUserId={currentUserId}
                  members={members}
                  amountStr={amountStr}
                  setAmountStr={setAmountStr}
                  expenseCurrency={expenseCurrency}
                  setExpenseCurrency={setExpenseCurrency}
                  ratePreview={ratePreview}
                  splitMethod={splitMethod}
                  setSplitMethod={setSplitMethod}
                  selected={selected}
                  setSelected={setSelected}
                  exactMap={exactMap}
                  setExactMap={setExactMap}
                  pctMap={pctMap}
                  setPctMap={setPctMap}
                  shareMap={shareMap}
                  setShareMap={setShareMap}
                  previewSplit={previewSplit}
                  submitLabel="Save expense"
                  pending={expensePending}
                />
              </form>
            </DialogContent>
            </Dialog>
            <Dialog
              open={!!editingExpense}
              onOpenChange={(open) => {
                if (!open) setEditingExpense(null);
              }}
            >
              <DialogContent title="Edit expense" className="max-w-lg">
                {editingExpense ? (
                  <form action={updateExpenseAction} className="space-y-4">
                    <ExpenseDialogForm
                      formKey={`edit-${editingExpense.id}`}
                      expenseId={editingExpense.id}
                      groupId={group.id}
                      groupCurrency={group.currency}
                      currentUserId={currentUserId}
                      members={members}
                      amountStr={editAmountStr}
                      setAmountStr={setEditAmountStr}
                      expenseCurrency={editExpenseCurrency}
                      setExpenseCurrency={setEditExpenseCurrency}
                      ratePreview={editRatePreview}
                      splitMethod={editSplitMethod}
                      setSplitMethod={setEditSplitMethod}
                      selected={editSelected}
                      setSelected={setEditSelected}
                      exactMap={editExactMap}
                      setExactMap={setEditExactMap}
                      pctMap={editPctMap}
                      setPctMap={setEditPctMap}
                      shareMap={editShareMap}
                      setShareMap={setEditShareMap}
                      previewSplit={editPreviewSplit}
                      defaultDescription={editingExpense.description}
                      defaultCategory={editingExpense.category}
                      defaultDateLocal={format(new Date(editingExpense.date), "yyyy-MM-dd'T'HH:mm")}
                      defaultPaidById={editingExpense.paidById}
                      defaultNotes={editingExpense.notes ?? ""}
                      submitLabel="Save changes"
                      pending={updateExpensePending}
                    />
                  </form>
                ) : null}
              </DialogContent>
            </Dialog>
            {isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "icon" }),
                    "shrink-0 border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  )}
                  aria-label="Group options"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => setConfirmDeleteGroup(true)}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    Delete group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
      </header>

      <Tabs value={groupTab} onValueChange={(v) => setGroupTab(v as GroupTab)}>
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
            <div className="space-y-2.5">
              {expenses.map((e) => (
                <Card
                  key={e.id}
                  data-e2e-expense-desc={e.description}
                  className="border-neutral-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <CardContent className="p-3.5 sm:p-4">
                    <div className="flex gap-3">
                      <MemberAvatar
                        className="shrink-0"
                        userId={e.paidBy.id}
                        name={e.paidBy.name}
                        email={e.paidBy.email}
                        avatarUrl={e.paidBy.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="font-medium leading-snug text-neutral-900">{e.description}</p>
                          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
                            ·
                          </span>
                          <CurrencyDisplay
                            className="text-sm sm:text-[15px]"
                            amount={e.amount}
                            currency={e.currency}
                            direction="neutral"
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed text-neutral-500 sm:text-xs">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-neutral-800",
                              expenseCategoryChipClass(e.category)
                            )}
                          >
                            <ExpenseCategoryIcon category={e.category} className="h-3.5 w-3.5" />
                            {expenseCategoryLabel(e.category)}
                          </span>
                          <span aria-hidden className="text-neutral-300">
                            ·
                          </span>
                          <span>{format(new Date(e.date), "MMM d, yyyy")}</span>
                          <span aria-hidden className="text-neutral-300">
                            ·
                          </span>
                          <span>
                            Paid by{" "}
                            <MemberName userId={e.paidBy.id} className="font-medium">
                              {e.paidBy.name ?? e.paidBy.email}
                            </MemberName>
                          </span>
                          <span aria-hidden className="text-neutral-300">
                            ·
                          </span>
                          <span>{SPLIT_METHODS.find((s) => s.value === e.splitMethod)?.label ?? e.splitMethod}</span>
                        </div>
                        {e.participants.length > 0 ? (
                          <ul
                            className="mt-2.5 space-y-1 rounded-lg border border-neutral-100 bg-neutral-50/90 px-2.5 py-2"
                            aria-label="Split breakdown"
                          >
                            {e.participants.map((p) => (
                              <li key={p.id} className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <MemberDot userId={p.userId} />
                                  <MemberName userId={p.userId} className="truncate font-medium">
                                    {p.user.name ?? p.user.email}
                                  </MemberName>
                                </span>
                                <span className="shrink-0 tabular-nums text-neutral-800">
                                  {formatCurrency(p.amount, e.currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {e.originalCurrency && e.originalCurrency !== e.currency && e.originalAmount != null ? (
                          <p className="mt-1 text-[11px] text-neutral-600 sm:text-xs">
                            Original: {formatCurrency(e.originalAmount, e.originalCurrency)} @ rate {e.exchangeRate}
                          </p>
                        ) : null}
                      </div>
                      <div className="-mr-1 flex shrink-0 flex-col gap-0.5 self-start sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-neutral-400 hover:text-neutral-700"
                          aria-label="Edit expense"
                          onClick={() => setEditingExpense(e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-neutral-400 hover:text-neutral-700"
                          aria-label="Delete expense"
                          onClick={() => setConfirmExpenseId(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <GroupBalancesExplainer
            groupCurrency={group.currency}
            currentUserId={currentUserId}
            members={members}
            balances={balances}
            suggestions={suggestions}
            onSettleSuggestion={(s) => {
              setSettlePreset({
                fromId: s.fromId,
                toId: s.toId,
                amount: s.amount.toFixed(2),
              });
              setSettleOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "member" : "members"}
                {invitations.length > 0 ? (
                  <> · Pending invitations: {invitations.map((i) => i.email).filter(Boolean).join(", ")}</>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isAdmin ? (
                <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/40 p-4 sm:p-5">
                  <AddMemberPicker
                    key={`${group.id}-${members.length}-${invitations.length}`}
                    groupId={group.id}
                    formAction={memberAction}
                    pending={memberPending}
                  />
                </div>
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
                      <MemberAvatar
                        userId={m.userId}
                        name={m.name}
                        email={m.email}
                        avatarUrl={m.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <MemberName userId={m.userId} className="text-sm font-medium">
                          {m.name ?? m.email}
                        </MemberName>
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
          <Card>
            <CardHeader>
              <CardTitle>Settlements</CardTitle>
              <CardDescription>
                {settlements.length === 0
                  ? "Payments logged between members in this group."
                  : `${settlements.length} ${settlements.length === 1 ? "payment" : "payments"} recorded · amounts in ${group.currency}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-neutral-200/90 bg-neutral-50/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-neutral-900">Record a settlement</p>
                    <p className="text-xs leading-relaxed text-neutral-600">
                      Use this when someone pays another member directly so running balances stay accurate.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      setSettlePreset(null);
                      setSettleOpen(true);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" aria-hidden />
                    Record settlement
                  </Button>
                </div>
              </div>

              <Separator />

              {settlements.length === 0 ? (
                <p className="py-4 text-center text-sm leading-relaxed text-neutral-500">
                  No settlements yet — add one when someone settles up.
                </p>
              ) : (
                <ul className="space-y-2" aria-label="Settlements in this group">
                  {settlements.map((s) => {
                    const fromLabel = s.from.name ?? s.from.email;
                    const toLabel = s.to.name ?? s.to.email;
                    const when = new Date(s.settledAt);
                    return (
                      <li
                        key={s.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                          getMemberPalette(s.fromId).rowBg
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex shrink-0 items-center gap-1" aria-hidden>
                            <MemberAvatar
                              size="sm"
                              userId={s.fromId}
                              name={s.from.name}
                              email={s.from.email}
                              avatarUrl={s.from.avatarUrl}
                            />
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" strokeWidth={2} />
                            <MemberAvatar
                              size="sm"
                              userId={s.toId}
                              name={s.to.name}
                              email={s.to.email}
                              avatarUrl={s.to.avatarUrl}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-800">
                              <MemberName userId={s.fromId}>{fromLabel}</MemberName>{" "}
                              <span className="font-normal text-neutral-500">paid</span>{" "}
                              <MemberName userId={s.toId}>{toLabel}</MemberName>
                            </p>
                            <p className="text-xs text-neutral-500">
                              {format(when, "MMM d, yyyy")} · {format(when, "h:mm a")}
                              {s.notes ? (
                                <>
                                  {" "}
                                  · <span className="text-neutral-600">{s.notes}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 sm:pl-2">
                          <CurrencyDisplay
                            className="text-sm sm:text-[15px]"
                            amount={s.amount}
                            currency={s.currency}
                            direction="neutral"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={settleOpen}
        onOpenChange={(open) => {
          setSettleOpen(open);
          if (!open) setSettlePreset(null);
        }}
      >
        <DialogContent title="Record settlement">
          <form
            key={
              settlePreset
                ? `p-${settlePreset.fromId}-${settlePreset.toId}-${settlePreset.amount}`
                : `d-${settleFormDataKey}`
            }
            action={settleAction}
            className="space-y-3"
          >
            <input type="hidden" name="groupId" value={group.id} />
            <div className="space-y-2">
              <Label>From</Label>
              <Select
                name="fromId"
                defaultValue={
                  settlePreset?.fromId ??
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
                  settlePreset?.toId ??
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
              <Input
                id="samount"
                name="amount"
                type="number"
                step="0.01"
                required
                defaultValue={settlePreset?.amount ?? ""}
              />
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
              toast({
                title: "Expense deleted",
                ...(r.message ? { description: r.message } : {}),
              });
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
