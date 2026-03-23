"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/server-user";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";
import { toNumber } from "@/lib/utils";

export async function getGroupDetailSerialized(groupId: string) {
  noStore();
  const user = await getAuthUser();
  if (!user) return null;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId } },
    include: { group: true },
  });
  if (!membership) return null;

  const g = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: {
          paidBy: true,
          participants: { include: { user: true } },
        },
        orderBy: { date: "desc" },
      },
      settlements: {
        include: { from: true, to: true },
        orderBy: { settledAt: "desc" },
      },
      invitations: { where: { status: "pending" } },
    },
  });
  if (!g) return null;

  const memberIds = g.members.map((m) => m.userId);
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

  const suggestions = minimizeDebts(balancesMap);

  return {
    role: membership.role,
    currentUserId: user.id,
    group: {
      id: g.id,
      name: g.name,
      description: g.description,
      category: g.category,
      currency: g.currency,
    },
    members: g.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    })),
    invitations: g.invitations.map((i) => ({
      id: i.id,
      email: i.email,
      status: i.status,
      expiresAt: i.expiresAt.toISOString(),
    })),
    expenses: g.expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: toNumber(e.amount),
      currency: e.currency,
      originalAmount: e.originalAmount != null ? toNumber(e.originalAmount) : null,
      originalCurrency: e.originalCurrency,
      exchangeRate: e.exchangeRate != null ? toNumber(e.exchangeRate) : null,
      category: e.category,
      date: e.date.toISOString(),
      notes: e.notes,
      splitMethod: e.splitMethod,
      paidById: e.paidById,
      paidBy: {
        id: e.paidBy.id,
        name: e.paidBy.name,
        email: e.paidBy.email,
        avatarUrl: e.paidBy.avatarUrl,
      },
      participants: e.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        amount: toNumber(p.amount),
        shares: p.shares,
        percentage: p.percentage != null ? toNumber(p.percentage) : null,
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          avatarUrl: p.user.avatarUrl,
        },
      })),
    })),
    balances: memberIds.map((uid) => {
      const m = g.members.find((x) => x.userId === uid)!;
      return {
        userId: uid,
        name: m.user.name,
        email: m.user.email,
        balance: balancesMap[uid] ?? 0,
      };
    }),
    suggestions: suggestions.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: s.amount,
      fromName:
        g.members.find((m) => m.userId === s.fromId)?.user.name ??
        g.members.find((m) => m.userId === s.fromId)?.user.email ??
        "",
      toName:
        g.members.find((m) => m.userId === s.toId)?.user.name ??
        g.members.find((m) => m.userId === s.toId)?.user.email ??
        "",
    })),
    settlements: g.settlements.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      amount: toNumber(s.amount),
      currency: s.currency,
      notes: s.notes,
      settledAt: s.settledAt.toISOString(),
      from: { name: s.from.name, email: s.from.email, avatarUrl: s.from.avatarUrl },
      to: { name: s.to.name, email: s.to.email, avatarUrl: s.to.avatarUrl },
    })),
  };
}

export type GroupDetailSerialized = NonNullable<Awaited<ReturnType<typeof getGroupDetailSerialized>>>;
