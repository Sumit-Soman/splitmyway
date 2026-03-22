"use client";

import { formatCurrency, cn } from "@/lib/utils";

export type BalanceSemantic = "positive" | "negative" | "zero";

export function CurrencyDisplay({
  amount = 0,
  currency,
  direction = "neutral",
  balanceSemantic,
  signedAmount,
  className,
}: {
  /** Absolute amount (e.g. your balance) unless `signedAmount` is used */
  amount?: number;
  currency: string;
  direction?: "you-owe" | "owed-to-you" | "neutral";
  balanceSemantic?: BalanceSemantic;
  /** Net balance for another member (+ = group owes them). Shows +/− prefix. */
  signedAmount?: number;
  className?: string;
}) {
  const useSigned = signedAmount !== undefined;
  const n = useSigned ? signedAmount : amount;
  const abs = Math.abs(n);
  const formatted = formatCurrency(abs, currency);
  const signPrefix = useSigned && n < 0 ? "−" : useSigned && n > 0 ? "+" : "";

  let color = "text-neutral-800";
  if (direction === "you-owe") {
    color = "text-rose-600";
  } else if (direction === "owed-to-you") {
    color = "text-emerald-600";
  } else if (direction === "neutral" && balanceSemantic) {
    if (balanceSemantic === "positive") color = "text-emerald-600";
    else if (balanceSemantic === "negative") color = "text-amber-600";
    else color = "text-neutral-400";
  } else if (direction === "neutral") {
    color = "text-neutral-800";
  }

  return (
    <span className={cn("inline-flex items-baseline gap-0 font-semibold tabular-nums tracking-tight", color, className)}>
      {signPrefix ? <span className="select-none">{signPrefix}</span> : null}
      {formatted}
    </span>
  );
}
