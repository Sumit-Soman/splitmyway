"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MoreVertical, Receipt, Trash2, Users } from "lucide-react";
import { deleteGroup } from "@/actions/groups";
import type { GroupListItem } from "@/actions/groups";
import { GROUP_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";

const metaChipClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-neutral-200/90 bg-neutral-50/90 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600";

export function GroupsList({ groups }: { groups: GroupListItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pendingGroup = pendingDeleteId ? groups.find((g) => g.id === pendingDeleteId) : null;

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => {
          const categoryLabel = GROUP_CATEGORIES.find((c) => c.value === g.category)?.label ?? g.category;
          const settled = Math.abs(g.yourBalance) < 0.001;

          return (
            <div
              key={g.id}
              className="group/card relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-neutral-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)]"
            >
              {g.role === "admin" ? (
                <div className="absolute right-3 top-5 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(
                        buttonVariants({ variant: "outline", size: "icon" }),
                        "h-9 w-9 shrink-0 border-neutral-200 bg-white/95 text-neutral-600 shadow-sm backdrop-blur-sm hover:bg-white"
                      )}
                      aria-label={`Options for ${g.name}`}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[10rem]">
                      <DropdownMenuItem
                        className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => setPendingDeleteId(g.id)}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        Delete group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}

              <Link
                href={`/groups/${g.id}`}
                className={cn(
                  "relative block p-6 pt-7 transition-colors hover:bg-neutral-50/30",
                  g.role === "admin" && "pr-14"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-0.5 opacity-90 transition-opacity group-hover/card:opacity-100",
                    settled ? "bg-neutral-200" : g.yourBalance > 0 ? "bg-emerald-500/80" : "bg-rose-500/80"
                  )}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight text-neutral-900 transition-colors group-hover/card:text-neutral-950">
                      {g.name}
                    </h2>
                    <span className={cn(metaChipClass)}>{categoryLabel}</span>
                  </div>
                  <ChevronRight
                    className="mt-1 h-5 w-5 shrink-0 text-neutral-300 transition-transform duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-neutral-500"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>

                {g.description ? (
                  <p className="mt-4 line-clamp-2 text-[15px] leading-relaxed text-neutral-600">{g.description}</p>
                ) : null}

                <div
                  className={cn(
                    "mt-5 rounded-xl border px-4 py-3",
                    settled
                      ? "border-neutral-100 bg-neutral-50/70"
                      : g.yourBalance > 0
                        ? "border-emerald-100/90 bg-emerald-50/50"
                        : "border-rose-100/90 bg-rose-50/50"
                  )}
                >
                  <p className="app-label-caps">Your balance</p>
                  <p
                    className={cn(
                      "mt-1.5 text-[15px] leading-snug",
                      settled ? "text-neutral-700" : g.yourBalance > 0 ? "text-emerald-800" : "text-rose-800"
                    )}
                  >
                    {settled ? (
                      <>
                        You&apos;re <span className="font-semibold">settled</span> — nothing owed either way.
                      </>
                    ) : g.yourBalance > 0 ? (
                      <>
                        You&apos;re owed{" "}
                        <span className="font-semibold tabular-nums">{formatCurrency(g.yourBalance, g.currency)}</span>{" "}
                        <span className="font-normal text-neutral-600">in this group.</span>
                      </>
                    ) : (
                      <>
                        You owe{" "}
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(Math.abs(g.yourBalance), g.currency)}
                        </span>{" "}
                        <span className="font-normal text-neutral-600">in this group.</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-100 pt-5 text-sm text-neutral-500">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 text-neutral-400" strokeWidth={1.75} aria-hidden />
                    <span>
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-neutral-400" strokeWidth={1.75} aria-hidden />
                    <span>
                      {g.expenseCount} {g.expenseCount === 1 ? "expense" : "expenses"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wide text-neutral-600">
                    {g.currency}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete group?"
        description={
          pendingGroup
            ? `“${pendingGroup.name}” will be removed for all members. Expenses and settlements in this group will be permanently deleted.`
            : undefined
        }
        variant="danger"
        confirmLabel="Delete group"
        loading={deleting}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          setDeleting(true);
          try {
            const r = await deleteGroup(pendingDeleteId);
            if (!r.success) {
              toast({ title: r.error ?? "Could not delete group", variant: "destructive" });
            } else {
              toast({ title: "Group deleted" });
              setPendingDeleteId(null);
              router.refresh();
            }
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
