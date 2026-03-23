/**
 * Database-backed scenario tests (group → expenses → settlements → deletes).
 * Opt-in: SPLITMYWAY_INTEGRATION=1 npm run test:integration
 * Uses DATABASE_URL (e.g. local Postgres). Cleans up created rows in finally blocks.
 */
import { describe, it, expect, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";
import { removeExpenseAndClearSettlementsIfLedgerEmpty } from "@/lib/ledger/expense-deletion";
import { toNumber } from "@/lib/utils";

const RUN = process.env.SPLITMYWAY_INTEGRATION === "1";

async function balancesForGroup(groupId: string) {
  const g = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      members: { select: { userId: true } },
      expenses: { include: { participants: true } },
      settlements: true,
    },
  });
  const memberIds = g.members.map((m) => m.userId);
  return calculateBalances({
    memberIds,
    expenses: g.expenses.map((e) => ({
      paidById: e.paidById,
      participants: e.participants.map((p) => ({
        userId: p.userId,
        amount: toNumber(p.amount),
      })),
    })),
    settlements: g.settlements.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: toNumber(s.amount),
    })),
  });
}

describe.skipIf(!RUN)("ledger scenarios (integration / e2e-style)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe.sequential("sequential DB scenarios", () => {
  it(
    "deleting the last expense clears settlements and zeroes balances (phantom balance fix)",
    async () => {
    const tag = `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userA = await prisma.user.create({
      data: { email: `a-${tag}@integration.test`, name: "Payer", currency: "USD" },
    });
    const userB = await prisma.user.create({
      data: { email: `b-${tag}@integration.test`, name: "Ower", currency: "USD" },
    });
    const group = await prisma.group.create({
      data: { name: `Group ${tag}`, category: "trip", currency: "USD" },
    });
    try {
      await prisma.groupMember.createMany({
        data: [
          { userId: userA.id, groupId: group.id, role: "admin" },
          { userId: userB.id, groupId: group.id, role: "member" },
        ],
      });

      const expense = await prisma.expense.create({
        data: {
          groupId: group.id,
          paidById: userA.id,
          description: "Dinner",
          amount: new Decimal("100.00"),
          currency: "USD",
          category: "food",
          splitMethod: "equal",
        },
      });
      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: expense.id, userId: userA.id, amount: new Decimal("50.00") },
          { expenseId: expense.id, userId: userB.id, amount: new Decimal("50.00") },
        ],
      });

      await prisma.settlement.create({
        data: {
          groupId: group.id,
          fromId: userB.id,
          toId: userA.id,
          amount: new Decimal("50.00"),
          currency: "USD",
        },
      });

      let bal = await balancesForGroup(group.id);
      expect(bal[userA.id]).toBeCloseTo(0, 2);
      expect(bal[userB.id]).toBeCloseTo(0, 2);
      expect(minimizeDebts(bal)).toHaveLength(0);

      await prisma.$transaction(async (tx) => {
        await removeExpenseAndClearSettlementsIfLedgerEmpty(tx, expense.id, group.id);
      });

      const settlementCount = await prisma.settlement.count({ where: { groupId: group.id } });
      expect(settlementCount).toBe(0);

      bal = await balancesForGroup(group.id);
      expect(bal[userA.id]).toBeCloseTo(0, 2);
      expect(bal[userB.id]).toBeCloseTo(0, 2);
      expect(minimizeDebts(bal)).toHaveLength(0);
    } finally {
      await prisma.group.delete({ where: { id: group.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
    }
    },
    30_000
  );

  it(
    "deleting one of two expenses does not remove settlements",
    async () => {
    const tag = `ledger2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userA = await prisma.user.create({
      data: { email: `a2-${tag}@integration.test`, name: "A", currency: "USD" },
    });
    const userB = await prisma.user.create({
      data: { email: `b2-${tag}@integration.test`, name: "B", currency: "USD" },
    });
    const group = await prisma.group.create({
      data: { name: `G2 ${tag}`, category: "other", currency: "USD" },
    });
    try {
      await prisma.groupMember.createMany({
        data: [
          { userId: userA.id, groupId: group.id, role: "admin" },
          { userId: userB.id, groupId: group.id, role: "member" },
        ],
      });

      const e1 = await prisma.expense.create({
        data: {
          groupId: group.id,
          paidById: userA.id,
          description: "E1",
          amount: new Decimal("40.00"),
          currency: "USD",
          category: "general",
          splitMethod: "equal",
        },
      });
      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: e1.id, userId: userA.id, amount: new Decimal("20.00") },
          { expenseId: e1.id, userId: userB.id, amount: new Decimal("20.00") },
        ],
      });

      const e2 = await prisma.expense.create({
        data: {
          groupId: group.id,
          paidById: userA.id,
          description: "E2",
          amount: new Decimal("60.00"),
          currency: "USD",
          category: "general",
          splitMethod: "equal",
        },
      });
      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: e2.id, userId: userA.id, amount: new Decimal("30.00") },
          { expenseId: e2.id, userId: userB.id, amount: new Decimal("30.00") },
        ],
      });

      await prisma.settlement.create({
        data: {
          groupId: group.id,
          fromId: userB.id,
          toId: userA.id,
          amount: new Decimal("10.00"),
          currency: "USD",
        },
      });

      await prisma.$transaction(async (tx) => {
        await removeExpenseAndClearSettlementsIfLedgerEmpty(tx, e1.id, group.id);
      });

      expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(1);
      expect(await prisma.settlement.count({ where: { groupId: group.id } })).toBe(1);

      const bal = await balancesForGroup(group.id);
      expect(bal[userA.id]! + bal[userB.id]!).toBeCloseTo(0, 2);
    } finally {
      await prisma.group.delete({ where: { id: group.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
    }
    },
    30_000
  );

  it(
    "unsettled single expense produces one minimized payment",
    async () => {
    const tag = `ledger3-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userA = await prisma.user.create({
      data: { email: `a3-${tag}@integration.test`, name: "A", currency: "USD" },
    });
    const userB = await prisma.user.create({
      data: { email: `b3-${tag}@integration.test`, name: "B", currency: "USD" },
    });
    const group = await prisma.group.create({
      data: { name: `G3 ${tag}`, category: "trip", currency: "USD" },
    });
    try {
      await prisma.groupMember.createMany({
        data: [
          { userId: userA.id, groupId: group.id, role: "admin" },
          { userId: userB.id, groupId: group.id, role: "member" },
        ],
      });

      const expense = await prisma.expense.create({
        data: {
          groupId: group.id,
          paidById: userA.id,
          description: "Hotel",
          amount: new Decimal("200.00"),
          currency: "USD",
          category: "general",
          splitMethod: "equal",
        },
      });
      await prisma.expenseParticipant.createMany({
        data: [
          { expenseId: expense.id, userId: userA.id, amount: new Decimal("100.00") },
          { expenseId: expense.id, userId: userB.id, amount: new Decimal("100.00") },
        ],
      });

      const bal = await balancesForGroup(group.id);
      const txs = minimizeDebts(bal);
      expect(txs).toHaveLength(1);
      expect(txs[0]!.fromId).toBe(userB.id);
      expect(txs[0]!.toId).toBe(userA.id);
      expect(txs[0]!.amount).toBeCloseTo(100, 2);
    } finally {
      await prisma.group.delete({ where: { id: group.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
    }
    },
    30_000
  );
  });
});
