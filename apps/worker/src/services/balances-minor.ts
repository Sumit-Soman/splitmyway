export type MinimizedTransactionMinor = {
  fromId: string;
  toId: string;
  amountMinor: number;
};

/**
 * Net balance per user in minor units: positive = owed to user, negative = user owes.
 */
export function calculateBalancesMinor(params: {
  memberIds: string[];
  expenses: Array<{
    paidById: string;
    participants: Array<{ userId: string; amountMinor: number }>;
  }>;
  settlements: Array<{ fromId: string; toId: string; amountMinor: number }>;
}): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const id of params.memberIds) {
    bal[id] = 0;
  }

  for (const e of params.expenses) {
    if (bal[e.paidById] === undefined) bal[e.paidById] = 0;
    let participantTotal = 0;
    for (const p of e.participants) {
      participantTotal += p.amountMinor;
      if (bal[p.userId] === undefined) bal[p.userId] = 0;
      bal[p.userId]! -= p.amountMinor;
    }
    bal[e.paidById]! += participantTotal;
  }

  for (const s of params.settlements) {
    if (bal[s.fromId] === undefined) bal[s.fromId] = 0;
    if (bal[s.toId] === undefined) bal[s.toId] = 0;
    bal[s.fromId]! += s.amountMinor;
    bal[s.toId]! -= s.amountMinor;
  }

  return bal;
}

export function minimizeDebtsMinor(balances: Record<string, number>): MinimizedTransactionMinor[] {
  /** Integer minor units only — avoids float dust from display→minor round-trips hanging the greedy loop. */
  const entries = Object.entries(balances).map(([userId, balance]) => ({
    userId,
    balance: Math.round(balance),
  }));

  const creditors = entries.filter((e) => e.balance > 0).sort((a, b) => b.balance - a.balance);
  const debtors = entries.filter((e) => e.balance < 0).sort((a, b) => a.balance - b.balance);

  const out: MinimizedTransactionMinor[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const pay = Math.min(c.balance, -d.balance);
    if (pay <= 0) break;
    out.push({
      fromId: d.userId,
      toId: c.userId,
      amountMinor: pay,
    });
    c.balance -= pay;
    d.balance += pay;
    if (c.balance <= 0) ci++;
    if (d.balance >= 0) di++;
  }

  return out;
}

export function minorToDisplayAmount(minor: number): number {
  return Math.round(minor) / 100;
}
