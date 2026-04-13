import type { RecordModel } from "pocketbase";
import { workerFetchJson } from "@/lib/worker/client";
import { recordToAppUserFromApi } from "@/lib/worker/user-map";
import { toNumber } from "@/lib/utils";

function fs(r: unknown, key: string): string {
  return String((r as Record<string, unknown>)?.[key] ?? "");
}

function fsn(r: unknown, key: string): string | null {
  const v = (r as Record<string, unknown>)?.[key];
  if (v == null || v === "") return null;
  return String(v);
}

function recordEmail(r: unknown): string {
  return String((r as Record<string, unknown>)?.email ?? "");
}

type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getAppUserById(id: string) {
  const { user } = await workerFetchJson<{ user: ApiUser }>(`/v1/users/by-id/${id}`);
  return recordToAppUserFromApi(user);
}

export async function listMembershipsForUser(userId: string) {
  const { memberships } = await workerFetchJson<{
    memberships: Array<{
      id: string;
      userId: string;
      groupId: string;
      role: string;
      joinedAt: string;
      group: { id: string; name: string; currency: string };
    }>;
  }>(`/v1/me/memberships`);
  return memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    groupId: m.groupId,
    role: m.role,
    joinedAt: new Date(m.joinedAt),
    group: m.group as unknown as RecordModel,
  }));
}

export async function findMembership(userId: string, groupId: string) {
  const rows = await listMembershipsForUser(userId);
  return rows.find((r) => r.groupId === groupId) ?? null;
}

export async function loadGroupsDataForUser(userId: string) {
  const { groupsData } = await workerFetchJson<{
    groupsData: Array<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      currency: string;
      members: Array<{
        id: string;
        userId: string;
        user: { id: string; name: string | null; email: string; avatarUrl: string | null };
      }>;
      expenses: Array<{
        id: string;
        paidById: string;
        amount: string;
        currency: string;
        participants: Array<{ userId: string; amount: string }>;
      }>;
      settlements: Array<{
        id: string;
        fromId: string;
        toId: string;
        amount: string;
        currency: string;
      }>;
    }>;
  }>(`/v1/dashboard`);
  void userId;
  return groupsData;
}

export async function loadGroupsExportData(userId: string, allowedGroupIds: string[]) {
  void userId;
  if (allowedGroupIds.length === 0) return [];
  const allowed = new Set(allowedGroupIds);
  const qs =
    allowedGroupIds.length === 1
      ? `?groupId=${encodeURIComponent(allowedGroupIds[0]!)}`
      : allowedGroupIds.length > 1
        ? `?groupIds=${encodeURIComponent(allowedGroupIds.join(","))}`
        : "";
  const { sections } = await workerFetchJson<{
    sections: Array<{
      groupId: string;
      name: string;
      currency: string;
      balances: Array<{ userId: string; name: string | null; email: string }>;
      expenses: Array<{
        id: string;
        description: string;
        amount: string;
        currency: string;
        originalAmount: string | null;
        originalCurrency: string | null;
        exchangeRate: string | null;
        category: string;
        date: string;
        splitMethod: string;
        paidBy: { id: string; name: string | null; email: string };
        participants: Array<{
          userId: string;
          amount: string;
          user: { email: string; name: string | null };
        }>;
      }>;
      settlements: Array<{
        id: string;
        fromId: string;
        toId: string;
        amount: number;
        settledAt: string;
        notes: string | null;
        from: { email: string; name: string | null };
        to: { email: string; name: string | null };
      }>;
    }>;
  }>(`/v1/reports${qs}`);

  return sections
    .filter((s) => allowed.has(s.groupId))
    .map((g) => ({
      id: g.groupId,
      name: g.name,
      currency: g.currency,
      members: g.balances.map((m) => ({
        userId: m.userId,
        user: {
          name: m.name,
          email: m.email,
          avatarUrl: null,
        },
      })),
      expenses: g.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        originalAmount: e.originalAmount,
        originalCurrency: e.originalCurrency,
        exchangeRate: e.exchangeRate,
        category: e.category,
        date: new Date(e.date),
        splitMethod: e.splitMethod,
        paidBy: e.paidBy,
        participants: e.participants,
      })),
      settlements: g.settlements.map((s) => ({
        id: s.id,
        fromId: s.fromId,
        toId: s.toId,
        amount: String(s.amount),
        settledAt: new Date(s.settledAt),
        notes: s.notes,
        from: s.from,
        to: s.to,
      })),
    }));
}

export async function getGroupDetailSerialized(groupId: string, userId: string) {
  const { detail } = await workerFetchJson<{ detail: Record<string, unknown> }>(
    `/v1/groups/${encodeURIComponent(groupId)}/detail`
  );
  void userId;
  const role = String(detail.role ?? "");
  const currentUserId = String(detail.currentUserId ?? "");
  const group = detail.group as Record<string, unknown>;
  const members = detail.members as Array<Record<string, unknown>>;
  const invitations = detail.invitations as Array<Record<string, unknown>>;
  const expensesRaw = detail.expenses as Array<Record<string, unknown>>;
  const balancesRaw = detail.balances as Array<Record<string, unknown>>;
  const suggestions = detail.suggestions as Array<Record<string, unknown>>;
  const settlementsRaw = detail.settlements as Array<Record<string, unknown>>;

  const memberIds = members.map((m) => String(m.userId));

  const expenses = expensesRaw.map((e) => {
    const paidByObj = e.paidBy as Record<string, unknown>;
    return {
      id: String(e.id),
      description: fs(e, "description"),
      amount: toNumber(String(e.amount)),
      currency: fs(e, "currency"),
      originalAmount: e.originalAmount != null ? toNumber(String(e.originalAmount)) : null,
      originalCurrency: fsn(e, "originalCurrency"),
      exchangeRate: e.exchangeRate != null ? toNumber(String(e.exchangeRate)) : null,
      category: fs(e, "category"),
      date: new Date(fs(e, "date")),
      notes: fsn(e, "notes"),
      attachmentFileName: fsn(e, "attachmentFileName"),
      splitMethod: fs(e, "splitMethod"),
      paidById: fs(e, "paidById"),
      paidBy: {
        id: String(paidByObj.id ?? fs(e, "paidById")),
        name: fsn(paidByObj, "name"),
        email: fs(paidByObj, "email"),
        avatarUrl: fsn(paidByObj, "avatarUrl"),
      },
      participants: (e.participants as Array<Record<string, unknown>>).map((p) => {
        const u = p.user as Record<string, unknown>;
        return {
          id: String(p.id),
          userId: fs(p, "userId"),
          amount: toNumber(String(p.amount)),
          shares: typeof p.shares === "number" ? p.shares : p.shares != null ? Number(p.shares) : null,
          percentage: p.percentage != null ? toNumber(String(p.percentage)) : null,
          user: {
            id: String(u.id ?? ""),
            name: fsn(u, "name"),
            email: fs(u, "email"),
            avatarUrl: fsn(u, "avatarUrl"),
          },
        };
      }),
    };
  });

  const settlements = settlementsRaw.map((s) => {
    const from = s.from as Record<string, unknown>;
    const to = s.to as Record<string, unknown>;
    return {
      id: String(s.id),
      fromId: fs(s, "fromId"),
      toId: fs(s, "toId"),
      amount: toNumber(String(s.amount)),
      currency: fs(s, "currency"),
      notes: fsn(s, "notes"),
      settledAt: new Date(fs(s, "settledAt")),
      from: {
        name: fsn(from, "name"),
        email: fs(from, "email"),
        avatarUrl: fsn(from, "avatarUrl"),
      },
      to: {
        name: fsn(to, "name"),
        email: fs(to, "email"),
        avatarUrl: fsn(to, "avatarUrl"),
      },
    };
  });

  const suggestionsRaw = detail.suggestions as Array<{
    fromId: string;
    toId: string;
    amount: number;
    fromName: string;
    toName: string;
  }>;

  return {
    role,
    currentUserId,
    group: {
      id: String(group.id),
      name: fs(group, "name"),
      description: fsn(group, "description"),
      category: fs(group, "category"),
      currency: fs(group, "currency"),
    },
    members: members.map((m) => ({
      id: String(m.id),
      userId: String(m.userId),
      role: fs(m, "role"),
      name: fsn(m, "name"),
      email: fs(m, "email"),
      avatarUrl: fsn(m, "avatarUrl"),
    })),
    invitations: invitations.map((i) => ({
      id: String(i.id),
      email: fsn(i, "email"),
      status: fs(i, "status"),
      expiresAt: new Date(fs(i, "expiresAt")).toISOString(),
    })),
    expenses,
    balances: memberIds.map((uid) => {
      const m = members.find((x) => String(x.userId) === uid)!;
      const br = balancesRaw.find((b) => String(b.userId) === uid);
      return {
        userId: uid,
        name: fsn(m, "name"),
        email: fs(m, "email"),
        balance: br != null ? toNumber(String(br.balance)) : 0,
      };
    }),
    suggestions: suggestionsRaw.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: s.amount,
      fromName: s.fromName,
      toName: s.toName,
    })),
    settlements,
  };
}
