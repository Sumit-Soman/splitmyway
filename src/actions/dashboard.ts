"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthUser, getDbUserById } from "@/lib/auth/server-user";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";
import { perf } from "@/lib/perf";

export async function getDashboardData() {
  noStore();
  const user = await perf("getAuthUser", () => getAuthUser());
  if (!user) return null;

  const [dbUser, groupsData] = await perf("prisma dashboard queries", () =>
    Promise.all([
      getDbUserById(user.id),
      prisma.group.findMany({
        where: { members: { some: { userId: user.id } } },
        include: {
          members: { include: { user: true } },
          expenses: { include: { participants: true } },
          settlements: true,
        },
      }),
    ])
  );

  let netBalance = 0;
  const groupSummaries: Array<{
    id: string;
    name: string;
    currency: string;
    memberCount: number;
    totalSpend: number;
    yourBalance: number;
  }> = [];

  const allSuggestions: Array<{
    groupId: string;
    groupName: string;
    currency: string;
    fromId: string;
    toId: string;
    amount: number;
    fromName: string | null;
    toName: string | null;
  }> = [];

  for (const g of groupsData) {
    const memberIds = g.members.map((x) => x.userId);
    const balancesMap = calculateBalances({
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
    const yourBal = balancesMap[user.id] ?? 0;
    netBalance += yourBal;

    groupSummaries.push({
      id: g.id,
      name: g.name,
      currency: g.currency,
      memberCount: g.members.length,
      totalSpend: Math.round(g.expenses.reduce((acc, e) => acc + toNumber(e.amount), 0) * 100) / 100,
      yourBalance: Math.round(yourBal * 100) / 100,
    });

    const txs = minimizeDebts(balancesMap);
    for (const t of txs) {
      if (t.fromId !== user.id && t.toId !== user.id) continue;
      const fromM = g.members.find((m) => m.userId === t.fromId);
      const toM = g.members.find((m) => m.userId === t.toId);
      allSuggestions.push({
        groupId: g.id,
        groupName: g.name,
        currency: g.currency,
        fromId: t.fromId,
        toId: t.toId,
        amount: t.amount,
        fromName: fromM?.user.name ?? fromM?.user.email ?? null,
        toName: toM?.user.name ?? toM?.user.email ?? null,
      });
    }
  }

  const pendingSettlements = allSuggestions.length;

  return {
    user: dbUser,
    netBalance: Math.round(netBalance * 100) / 100,
    activeGroups: groupsData.length,
    pendingSettlements,
    groups: groupSummaries,
    suggestions: allSuggestions,
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
