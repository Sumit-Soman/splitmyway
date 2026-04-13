export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export type SplitInputMinor = {
  method: SplitMethod;
  totalCents: number;
  participantIds: string[];
  exactCents?: Record<string, number>;
  percentages?: Record<string, number>;
  shares?: Record<string, number>;
};

export type SplitResultMinor =
  | { ok: true; centsByUser: Record<string, number> }
  | { ok: false; error: string };

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

export function calculateSplitMinor(input: SplitInputMinor): SplitResultMinor {
  const ids = [...new Set(input.participantIds)].filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, error: "At least one participant is required." };
  }
  const totalCents = input.totalCents;
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    return { ok: false, error: "Total amount must be a positive whole number of cents." };
  }

  switch (input.method) {
    case "equal": {
      const cents = distributeEqual(totalCents, ids.length);
      const centsByUser: Record<string, number> = {};
      ids.forEach((id, i) => {
        centsByUser[id] = cents[i]!;
      });
      return { ok: true, centsByUser };
    }
    case "exact": {
      const exact = input.exactCents ?? {};
      let sum = 0;
      const centsByUser: Record<string, number> = {};
      for (const id of ids) {
        const v = exact[id];
        if (v === undefined || !Number.isInteger(v) || v < 0) {
          return { ok: false, error: "Exact cent amount required for each participant." };
        }
        centsByUser[id] = v;
        sum += v;
      }
      if (sum !== totalCents) {
        return {
          ok: false,
          error: `Exact amounts must sum to ${(totalCents / 100).toFixed(2)} (got ${(sum / 100).toFixed(2)}).`,
        };
      }
      return { ok: true, centsByUser };
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
      while (allocated < totalCents && i < ids.length * 10000) {
        rawCents[i % ids.length]! += 1;
        allocated += 1;
        i++;
      }
      const centsByUser: Record<string, number> = {};
      ids.forEach((id, idx) => {
        centsByUser[id] = rawCents[idx]!;
      });
      return { ok: true, centsByUser };
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
      const centsByUser: Record<string, number> = {};
      ids.forEach((id, idx) => {
        centsByUser[id] = rawCents[idx]!;
      });
      return { ok: true, centsByUser };
    }
    default:
      return { ok: false, error: "Unknown split method." };
  }
}
