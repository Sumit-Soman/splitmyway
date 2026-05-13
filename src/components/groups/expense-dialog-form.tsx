"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MemberDot, MemberName } from "@/components/shared/member-avatar";
import { formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  MAX_EXPENSE_ATTACHMENT_BYTES,
  MAX_EXPENSE_ATTACHMENT_LABEL,
  SPLIT_METHODS,
  CURRENCIES,
} from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import type { SplitResult } from "@/lib/calculations/splits";

type MemberRow = {
  userId: string;
  name: string | null;
  email: string;
};

export function ExpenseDialogForm({
  groupId,
  groupCurrency,
  currentUserId,
  members,
  amountStr,
  setAmountStr,
  expenseCurrency,
  setExpenseCurrency,
  ratePreview,
  splitMethod,
  setSplitMethod,
  selected,
  setSelected,
  exactMap,
  setExactMap,
  pctMap,
  setPctMap,
  shareMap,
  setShareMap,
  previewSplit,
  formKey,
  expenseId,
  defaultDescription,
  defaultCategory,
  defaultDateLocal,
  defaultPaidById,
  defaultNotes,
  defaultAttachmentFileName,
  submitLabel,
  pending,
}: {
  groupId: string;
  groupCurrency: string;
  currentUserId: string;
  members: MemberRow[];
  amountStr: string;
  setAmountStr: (v: string) => void;
  expenseCurrency: string;
  setExpenseCurrency: (v: string) => void;
  ratePreview: { rate: number; converted: number } | null;
  splitMethod: "equal" | "exact" | "percentage" | "shares";
  setSplitMethod: (v: "equal" | "exact" | "percentage" | "shares") => void;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  exactMap: Record<string, string>;
  setExactMap: Dispatch<SetStateAction<Record<string, string>>>;
  pctMap: Record<string, string>;
  setPctMap: Dispatch<SetStateAction<Record<string, string>>>;
  shareMap: Record<string, string>;
  setShareMap: Dispatch<SetStateAction<Record<string, string>>>;
  previewSplit: SplitResult | null;
  /** Remounts defaultValue fields when switching add vs edit or another expense */
  formKey: string;
  expenseId?: string;
  defaultDescription?: string;
  defaultCategory?: string;
  defaultDateLocal?: string;
  defaultPaidById?: string;
  defaultNotes?: string;
  /** When editing, name of existing attachment (if any). */
  defaultAttachmentFileName?: string | null;
  submitLabel: string;
  pending: boolean;
}) {
  const { toast } = useToast();
  /** Create: others in `selected`, you always included. Edit: full participant set from expense. */
  const participantIds = useMemo(() => {
    if (expenseId) return Array.from(selected);
    return Array.from(new Set([...selected, currentUserId]));
  }, [expenseId, selected, currentUserId]);

  const otherMembers = useMemo(
    () => members.filter((m) => m.userId !== currentUserId),
    [members, currentUserId]
  );

  const labelForUserId = (userId: string) =>
    userId === currentUserId
      ? "You"
      : (members.find((x) => x.userId === userId)?.name ??
        members.find((x) => x.userId === userId)?.email ??
        userId);

  return (
    <div key={formKey} className="space-y-4">
      {expenseId ? <input type="hidden" name="expenseId" value={expenseId} /> : null}
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`description-${formKey}`}>Description</Label>
          <Input
            id={`description-${formKey}`}
            name="description"
            required
            defaultValue={defaultDescription ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`amount-${formKey}`}>Amount</Label>
          <Input
            id={`amount-${formKey}`}
            name="amount"
            type="number"
            step="0.01"
            required
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`currency-${formKey}`}>Currency</Label>
          <Select
            id={`currency-${formKey}`}
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
        {expenseCurrency !== groupCurrency && ratePreview ? (
          <div className="sm:col-span-2 rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-800">
            Live rate: 1 {expenseCurrency} = {ratePreview.rate.toFixed(6)} {groupCurrency}. Converted:{" "}
            <strong>{formatCurrency(ratePreview.converted, groupCurrency)}</strong>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`category-${formKey}`}>Category</Label>
          <Select
            id={`category-${formKey}`}
            name="category"
            defaultValue={defaultCategory ?? "general"}
            key={`cat-${formKey}-${defaultCategory ?? "general"}`}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`date-${formKey}`}>Date</Label>
          <Input
            id={`date-${formKey}`}
            name="date"
            type="datetime-local"
            defaultValue={
              defaultDateLocal ?? format(new Date(), "yyyy-MM-dd'T'HH:mm")
            }
            key={`date-${formKey}-${defaultDateLocal ?? ""}`}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`paidById-${formKey}`}>Paid by</Label>
          <Select
            id={`paidById-${formKey}`}
            name="paidById"
            defaultValue={defaultPaidById ?? currentUserId}
            key={`paid-${formKey}-${defaultPaidById ?? currentUserId}`}
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`notes-${formKey}`}>Notes</Label>
          <Textarea
            id={`notes-${formKey}`}
            name="notes"
            rows={2}
            defaultValue={defaultNotes ?? ""}
            key={`notes-${formKey}`}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`attachment-${formKey}`}>Attachment</Label>
          <p className="text-xs text-neutral-500">Any file type · max {MAX_EXPENSE_ATTACHMENT_LABEL}</p>
          <Input
            id={`attachment-${formKey}`}
            name="attachment"
            type="file"
            className="cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-800"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > MAX_EXPENSE_ATTACHMENT_BYTES) {
                toast({
                  title: "File too large",
                  description: `Attachments must be ${MAX_EXPENSE_ATTACHMENT_LABEL} or smaller (database limit).`,
                  variant: "destructive",
                });
                e.target.value = "";
              }
            }}
          />
          {defaultAttachmentFileName ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-700">
              <p className="mb-2">
                Current: <span className="font-medium text-neutral-900">{defaultAttachmentFileName}</span>
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="removeAttachment" value="1" disabled={pending} />
                Remove attachment
              </label>
            </div>
          ) : null}
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
          {otherMembers.map((m) => (
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
                {labelForUserId(id)}
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
                {labelForUserId(id)}
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
                {labelForUserId(id)}
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
          <p className="mb-2 font-medium text-neutral-700">Split preview ({groupCurrency})</p>
          <ul className="space-y-1">
            {Object.entries(previewSplit.amounts).map(([uid, amt]) => (
              <li key={uid} className="flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <MemberDot userId={uid} />
                  <MemberName userId={uid} className="truncate font-medium">
                    {labelForUserId(uid)}
                  </MemberName>
                </span>
                <span className="tabular-nums text-neutral-900">{formatCurrency(amt, groupCurrency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : previewSplit && !previewSplit.ok ? (
        <p className="text-sm text-red-600">{previewSplit.error}</p>
      ) : null}

      <Button type="submit" disabled={pending || participantIds.length === 0}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}
