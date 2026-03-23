export type MemberBalance = {
  userId: string;
  balance: number;
};

export type MinimizedTransaction = {
  fromId: string;
  toId: string;
  amount: number;
};

/**
 * Net balance per user: positive = owed to user, negative = user owes.
 * Expenses: payer is credited total; each participant debited their share.
 * Settlements: from pays to — reduces debtor’s negative balance and creditor’s positive balance (both toward zero).
 *
 * App rule: when a group has **no expenses**, all settlements for that group are removed (see expense deletion).
 * Otherwise, settlements with an empty expense list would leave phantom balances.
 */
export function calculateBalances(params: {
  memberIds: string[];
  expenses: Array<{
    paidById: string;
    participants: Array<{ userId: string; amount: number }>;
  }>;
  settlements: Array<{ fromId: string; toId: string; amount: number }>;
}): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const id of params.memberIds) {
    bal[id] = 0;
  }

  for (const e of params.expenses) {
    if (bal[e.paidById] === undefined) bal[e.paidById] = 0;
    let participantTotal = 0;
    for (const p of e.participants) {
      participantTotal += p.amount;
      if (bal[p.userId] === undefined) bal[p.userId] = 0;
      bal[p.userId] -= p.amount;
    }
    bal[e.paidById] += participantTotal;
  }

  for (const s of params.settlements) {
    if (bal[s.fromId] === undefined) bal[s.fromId] = 0;
    if (bal[s.toId] === undefined) bal[s.toId] = 0;
    bal[s.fromId] += s.amount;
    bal[s.toId] -= s.amount;
  }

  for (const id of Object.keys(bal)) {
    bal[id] = Math.round(bal[id]! * 100) / 100;
  }
  return bal;
}

/**
 * Greedy minimize cash flow: repeatedly match largest creditor with largest debtor.
 */
export function minimizeDebts(balances: Record<string, number>): MinimizedTransaction[] {
  const entries = Object.entries(balances).map(([userId, balance]) => ({
    userId,
    balance: Math.round(balance * 100) / 100,
  }));

  const creditors = entries
    .filter((e) => e.balance > 0.001)
    .sort((a, b) => b.balance - a.balance);
  const debtors = entries
    .filter((e) => e.balance < -0.001)
    .sort((a, b) => a.balance - b.balance);

  const out: MinimizedTransaction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const pay = Math.min(c.balance, -d.balance);
    if (pay < 0.001) break;
    out.push({
      fromId: d.userId,
      toId: c.userId,
      amount: Math.round(pay * 100) / 100,
    });
    c.balance -= pay;
    d.balance += pay;
    if (c.balance < 0.001) ci++;
    if (d.balance > -0.001) di++;
  }

  return out;
}
