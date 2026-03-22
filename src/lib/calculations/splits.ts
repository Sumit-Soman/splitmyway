export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export type SplitInput = {
  method: SplitMethod;
  totalAmount: number;
  participantIds: string[];
  /** For exact: userId -> amount */
  exactAmounts?: Record<string, number>;
  /** For percentage: userId -> percentage (0-100) */
  percentages?: Record<string, number>;
  /** For shares: userId -> share count */
  shares?: Record<string, number>;
};

export type SplitResult =
  | { ok: true; amounts: Record<string, number> }
  | { ok: false; error: string };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Distribute remainder cents to first participants */
function distributeEqual(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const rem = totalCents - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

export function calculateSplit(input: SplitInput): SplitResult {
  const ids = [...new Set(input.participantIds)].filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, error: "At least one participant is required." };
  }

  const total = input.totalAmount;
  if (total <= 0 || !Number.isFinite(total)) {
    return { ok: false, error: "Total amount must be positive." };
  }

  const totalCents = Math.round(total * 100);

  switch (input.method) {
    case "equal": {
      const cents = distributeEqual(totalCents, ids.length);
      const amounts: Record<string, number> = {};
      ids.forEach((id, i) => {
        amounts[id] = round2(cents[i]! / 100);
      });
      return { ok: true, amounts };
    }
    case "exact": {
      const exact = input.exactAmounts ?? {};
      let sumCents = 0;
      const amounts: Record<string, number> = {};
      for (const id of ids) {
        const v = exact[id];
        if (v === undefined || !Number.isFinite(v)) {
          return { ok: false, error: "Exact amount required for each participant." };
        }
        const c = Math.round(v * 100);
        amounts[id] = round2(c / 100);
        sumCents += c;
      }
      if (sumCents !== totalCents) {
        return {
          ok: false,
          error: `Exact amounts must sum to ${total.toFixed(2)} (got ${(sumCents / 100).toFixed(2)}).`,
        };
      }
      return { ok: true, amounts };
    }
    case "percentage": {
      const pct = input.percentages ?? {};
      let sumPct = 0;
      for (const id of ids) {
        const v = pct[id];
        if (v === undefined || !Number.isFinite(v) || v < 0) {
          return { ok: false, error: "Percentage required for each participant (0–100)." };
        }
        sumPct += v;
      }
      if (Math.abs(sumPct - 100) > 0.01) {
        return { ok: false, error: "Percentages must sum to 100%." };
      }
      const rawCents = ids.map((id) => Math.floor((totalCents * (pct[id] ?? 0)) / 100));
      let allocated = rawCents.reduce((a, b) => a + b, 0);
      let i = 0;
      while (allocated < totalCents && i < ids.length * 100) {
        rawCents[i % ids.length]! += 1;
        allocated += 1;
        i++;
      }
      const amounts: Record<string, number> = {};
      ids.forEach((id, idx) => {
        amounts[id] = round2(rawCents[idx]! / 100);
      });
      return { ok: true, amounts };
    }
    case "shares": {
      const sh = input.shares ?? {};
      let totalShares = 0;
      for (const id of ids) {
        const v = sh[id];
        if (v === undefined || !Number.isFinite(v) || v <= 0) {
          return { ok: false, error: "Positive share count required for each participant." };
        }
        totalShares += Math.floor(v);
      }
      if (totalShares <= 0) {
        return { ok: false, error: "Total shares must be positive." };
      }
      const rawCents = ids.map((id) => Math.floor((totalCents * Math.floor(sh[id]!)) / totalShares));
      let allocated = rawCents.reduce((a, b) => a + b, 0);
      let i = 0;
      while (allocated < totalCents) {
        rawCents[i % rawCents.length]! += 1;
        allocated += 1;
        i++;
      }
      const amounts: Record<string, number> = {};
      ids.forEach((id, idx) => {
        amounts[id] = round2(rawCents[idx]! / 100);
      });
      return { ok: true, amounts };
    }
    default:
      return { ok: false, error: "Unknown split method." };
  }
}

export function validateSplit(input: SplitInput): SplitResult {
  return calculateSplit(input);
}
