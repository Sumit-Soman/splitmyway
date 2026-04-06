"use server";

import { getAuthUser } from "@/lib/auth/server-user";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";
import { recordField } from "@/lib/pocketbase/record-field";
import { listMembershipsForUser, loadGroupsExportData } from "@/lib/pocketbase/queries";

type GroupReportSection = {
  groupId: string;
  name: string;
  currency: string;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    originalAmount: number | null;
    originalCurrency: string | null;
    exchangeRate: number | null;
    category: string;
    date: string;
    splitMethod: string;
    paidByName: string;
    participants: Array<{ userId: string; amount: number; label: string }>;
  }>;
  balances: Array<{
    userId: string;
    name: string | null;
    email: string;
    balance: number;
    isYou: boolean;
  }>;
  suggestions: Array<{
    fromId: string;
    toId: string;
    amount: number;
    fromLabel: string;
    toLabel: string;
  }>;
  settlements: Array<{
    id: string;
    amount: number;
    settledAt: string;
    notes: string | null;
    fromLabel: string;
    toLabel: string;
  }>;
};

export async function getReportData(groupId: string | null) {
  const user = await getAuthUser();
  if (!user) return null;

  const memberships = await listMembershipsForUser(user.id);
  if (memberships.length === 0) {
    return {
      groups: [] as Array<{ id: string; name: string; currency: string }>,
      sections: [] as GroupReportSection[],
      summary: { totalSpend: 0, expenseCount: 0, groupCount: 0, peopleCount: 0 },
    };
  }

  const groupPicker = memberships.map((m) => ({
    id: m.groupId,
    name: String(recordField(m.group, "name") ?? ""),
    currency: String(recordField(m.group, "currency") ?? "USD"),
  }));

  const selectedIds = groupId
    ? memberships.filter((m) => m.groupId === groupId).map((m) => m.groupId)
    : memberships.map((m) => m.groupId);

  if (selectedIds.length === 0) {
    return {
      groups: groupPicker,
      sections: [] as GroupReportSection[],
      summary: { totalSpend: 0, expenseCount: 0, groupCount: 0, peopleCount: 0 },
    };
  }

  const groupsData = await loadGroupsExportData(user.id, selectedIds);

  let totalSpend = 0;
  let expenseCount = 0;
  const people = new Set<string>();

  const sections: GroupReportSection[] = groupsData.map((g) => {
    const memberIds = g.members.map((m) => m.userId);

    const balancesMap = calculateBalances({
      memberIds,
      expenses: g.expenses.map((e) => ({
        paidById: e.paidBy.id,
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

    const suggestions = minimizeDebts(balancesMap);

    for (const e of g.expenses) {
      totalSpend += toNumber(e.amount);
      expenseCount += 1;
    }
    for (const m of g.members) {
      people.add(m.userId);
    }

    return {
      groupId: g.id,
      name: g.name,
      currency: g.currency,
      expenses: g.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: toNumber(e.amount),
        currency: e.currency,
        originalAmount: e.originalAmount ? toNumber(e.originalAmount) : null,
        originalCurrency: e.originalCurrency,
        exchangeRate: e.exchangeRate ? toNumber(e.exchangeRate) : null,
        category: e.category,
        date: e.date.toISOString(),
        splitMethod: e.splitMethod,
        paidByName: e.paidBy.name ?? e.paidBy.email,
        participants: e.participants.map((p) => ({
          userId: p.userId,
          amount: toNumber(p.amount),
          label: p.user.name ?? p.user.email,
        })),
      })),
      balances: memberIds.map((uid) => {
        const m = g.members.find((x) => x.userId === uid)!;
        return {
          userId: uid,
          name: m.user.name,
          email: m.user.email,
          balance: balancesMap[uid] ?? 0,
          isYou: uid === user.id,
        };
      }),
      suggestions: suggestions.map((s) => ({
        fromId: s.fromId,
        toId: s.toId,
        amount: s.amount,
        fromLabel:
          g.members.find((m) => m.userId === s.fromId)?.user.name ??
          g.members.find((m) => m.userId === s.fromId)?.user.email ??
          "",
        toLabel:
          g.members.find((m) => m.userId === s.toId)?.user.name ??
          g.members.find((m) => m.userId === s.toId)?.user.email ??
          "",
      })),
      settlements: g.settlements.map((s) => ({
        id: s.id,
        amount: toNumber(s.amount),
        settledAt: s.settledAt.toISOString(),
        notes: s.notes,
        fromLabel: s.from.name ?? s.from.email,
        toLabel: s.to.name ?? s.to.email,
      })),
    };
  });

  return {
    groups: groupPicker,
    sections,
    summary: {
      totalSpend,
      expenseCount,
      groupCount: groupsData.length,
      peopleCount: people.size,
    },
  };
}
