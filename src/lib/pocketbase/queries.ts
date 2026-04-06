import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { getAdminPb } from "./admin";
import { publicUserFromRecord, recordToAppUser } from "./user-map";
import { fileFieldName, recordField } from "./record-field";
import { toNumber } from "@/lib/utils";
import { escapeFilterValue } from "./filter-escape";
import { calculateBalances, minimizeDebts } from "@/lib/calculations/balances";

/** Relation id or any field string (SDK records may be plain objects without `.get`). */
function relId(r: unknown, field: string): string {
  return String(recordField(r, field) ?? "");
}

function fs(r: unknown, key: string): string {
  return String(recordField(r, key) ?? "");
}

function fsn(r: unknown, key: string): string | null {
  const v = recordField(r, key);
  if (v == null || v === "") return null;
  return String(v);
}

function recordEmail(r: unknown): string {
  return String(recordField(r, "email") ?? "");
}

export async function getUserRecordById(pb: PocketBase, id: string) {
  return pb.collection("users").getOne(id);
}

export async function getAppUserById(id: string) {
  const pb = await getAdminPb();
  const r = await getUserRecordById(pb, id);
  return recordToAppUser(pb, r);
}

/** Membership rows for a user, newest first. */
export async function listMembershipsForUser(userId: string) {
  const pb = await getAdminPb();
  const rows = await pb.collection("group_members").getFullList({
    filter: `user = "${escapeFilterValue(userId)}"`,
    sort: "-joined_at",
    expand: "group",
  });
  return rows.map((m) => ({
    id: m.id,
    userId: relId(m, "user"),
    groupId: relId(m, "group"),
    role: fs(m, "role"),
    joinedAt: new Date(fs(m, "joined_at")),
    group: m.expand?.group as RecordModel | undefined,
  }));
}

export async function findMembership(userId: string, groupId: string) {
  const pb = await getAdminPb();
  const rows = await pb.collection("group_members").getFullList({
    filter: `user = "${escapeFilterValue(userId)}" && group = "${escapeFilterValue(groupId)}"`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function loadGroupDetailBundle(groupId: string) {
  const pb = await getAdminPb();
  const g = await pb.collection("groups").getOne(groupId);

  const members = await pb.collection("group_members").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
    expand: "user",
  });

  const expenses = await pb.collection("expenses").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
    sort: "-date",
    expand: "paid_by",
  });

  const participantsByExpense = new Map<string, RecordModel[]>();
  for (const e of expenses) {
    const parts = await pb.collection("expense_participants").getFullList({
      filter: `expense = "${escapeFilterValue(e.id)}"`,
      expand: "user",
    });
    participantsByExpense.set(e.id, parts);
  }

  const settlements = await pb.collection("settlements").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}"`,
    sort: "-settled_at",
    expand: "from_user,to_user",
  });

  const invitations = await pb.collection("invitations").getFullList({
    filter: `group = "${escapeFilterValue(groupId)}" && status = "pending"`,
  });

  return {
    group: g,
    members,
    expenses,
    participantsByExpense,
    settlements,
    invitations,
  };
}

/** Full group data for dashboard / balance math. */
export async function loadGroupsDataForUser(userId: string) {
  const pb = await getAdminPb();
  const memberships = await listMembershipsForUser(userId);
  const groupIds = memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return [];

  type MemberRow = {
    id: string;
    userId: string;
    user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  };

  type ExpRow = {
    id: string;
    paidById: string;
    amount: string;
    currency: string;
    participants: Array<{ userId: string; amount: string }>;
  };

  const out: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    currency: string;
    members: MemberRow[];
    expenses: ExpRow[];
    settlements: Array<{ id: string; fromId: string; toId: string; amount: string; currency: string }>;
  }> = [];

  for (const gid of groupIds) {
    const g = await pb.collection("groups").getOne(gid);
    const memRows = await pb.collection("group_members").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
      expand: "user",
    });
    const expRows = await pb.collection("expenses").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
      expand: "paid_by",
    });
    const expenses: ExpRow[] = [];

    for (const e of expRows) {
      const plist = await pb.collection("expense_participants").getFullList({
        filter: `expense = "${escapeFilterValue(e.id)}"`,
      });
      expenses.push({
        id: e.id,
        paidById: relId(e, "paid_by"),
        amount: fs(e, "amount"),
        currency: fs(e, "currency"),
        participants: plist.map((p) => ({
          userId: relId(p, "user"),
          amount: fs(p, "amount"),
        })),
      });
    }

    const setRows = await pb.collection("settlements").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
    });

    out.push({
      id: g.id,
      name: fs(g, "name"),
      description: fsn(g, "description"),
      category: fs(g, "category"),
      currency: fs(g, "currency"),
      members: memRows.map((m) => {
        const u = m.expand?.user as RecordModel;
        return {
          id: m.id,
          userId: relId(m, "user"),
          user: publicUserFromRecord(pb, u),
        };
      }),
      expenses,
      settlements: setRows.map((s) => ({
        id: s.id,
        fromId: relId(s, "from_user"),
        toId: relId(s, "to_user"),
        amount: fs(s, "amount"),
        currency: fs(s, "currency"),
      })),
    });
  }

  const order = new Map(groupIds.map((id, i) => [id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return out;
}

/** Rich export shape for PDF/CSV routes (per-group expenses with user labels). */
export async function loadGroupsExportData(userId: string, allowedGroupIds: string[]) {
  const pb = await getAdminPb();
  const memberships = await listMembershipsForUser(userId);
  const allowed = new Set(allowedGroupIds);
  const groupIds = memberships.map((m) => m.groupId).filter((id) => allowed.has(id));
  if (groupIds.length === 0) return [];

  const groups = [];
  for (const gid of groupIds) {
    const g = await pb.collection("groups").getOne(gid);
    const memRows = await pb.collection("group_members").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
      expand: "user",
    });
    const memberByUserId = new Map(
      memRows.map((m) => {
        const u = m.expand?.user as RecordModel;
        return [
          relId(m, "user"),
          { name: fsn(u, "name"), email: recordEmail(u) },
        ] as const;
      })
    );

    const expRows = await pb.collection("expenses").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
      sort: "date",
      expand: "paid_by",
    });

    const expensesOut = [];
    for (const e of expRows) {
      const paidBy = e.expand?.paid_by as RecordModel;
      const plist = await pb.collection("expense_participants").getFullList({
        filter: `expense = "${escapeFilterValue(e.id)}"`,
        expand: "user",
      });
      expensesOut.push({
        id: e.id,
        description: fs(e, "description"),
        amount: fs(e, "amount"),
        currency: fs(e, "currency"),
        originalAmount: fsn(e, "original_amount"),
        originalCurrency: fsn(e, "original_currency"),
        exchangeRate: fsn(e, "exchange_rate"),
        category: fs(e, "category"),
        date: new Date(fs(e, "date")),
        splitMethod: fs(e, "split_method"),
        paidBy: { id: paidBy.id, name: fsn(paidBy, "name"), email: recordEmail(paidBy) },
        participants: plist.map((p) => {
          const u = p.expand?.user as RecordModel | undefined;
          const uid = relId(p, "user");
          return {
            userId: uid,
            amount: fs(p, "amount"),
            user: u
              ? { email: recordEmail(u), name: fsn(u, "name") }
              : { email: memberByUserId.get(uid)?.email ?? "", name: memberByUserId.get(uid)?.name ?? null },
          };
        }),
      });
    }

    const setRows = await pb.collection("settlements").getFullList({
      filter: `group = "${escapeFilterValue(gid)}"`,
      sort: "-settled_at",
      expand: "from_user,to_user",
    });

    groups.push({
      id: g.id,
      name: fs(g, "name"),
      currency: fs(g, "currency"),
      members: memRows.map((m) => ({
        userId: relId(m, "user"),
        user: publicUserFromRecord(pb, m.expand?.user as RecordModel),
      })),
      expenses: expensesOut,
      settlements: setRows.map((s) => {
        const from = s.expand?.from_user as RecordModel;
        const to = s.expand?.to_user as RecordModel;
        return {
          id: s.id,
          fromId: from.id,
          toId: to.id,
          amount: fs(s, "amount"),
          settledAt: new Date(fs(s, "settled_at")),
          notes: fsn(s, "notes"),
          from: { email: recordEmail(from), name: fsn(from, "name") },
          to: { email: recordEmail(to), name: fsn(to, "name") },
        };
      }),
    });
  }

  return groups;
}

/** Serialized group detail for the group page. */
export async function getGroupDetailSerialized(groupId: string, userId: string) {
  const pb = await getAdminPb();
  const membership = await findMembership(userId, groupId);
  if (!membership) return null;

  const bundle = await loadGroupDetailBundle(groupId);
  const g = bundle.group;

  const memberRows = bundle.members.map((m) => {
    const u = m.expand?.user as RecordModel;
    const av = fsn(u, "avatar");
    return {
      id: m.id,
      userId: relId(m, "user"),
      role: fs(m, "role"),
      name: fsn(u, "name"),
      email: recordEmail(u),
      avatarUrl: av ? pb.files.getUrl(u as Record<string, unknown>, av) : null,
    };
  });

  const memberIds = memberRows.map((m) => m.userId);

  const expenses = bundle.expenses.map((e) => {
    const paidBy = e.expand?.paid_by as RecordModel;
    const plist = bundle.participantsByExpense.get(e.id) ?? [];
    const paidAv = fsn(paidBy, "avatar");
    return {
      id: e.id,
      description: fs(e, "description"),
      amount: toNumber(fs(e, "amount")),
      currency: fs(e, "currency"),
      originalAmount: recordField(e, "original_amount") ? toNumber(fs(e, "original_amount")) : null,
      originalCurrency: fsn(e, "original_currency"),
      exchangeRate: recordField(e, "exchange_rate") ? toNumber(fs(e, "exchange_rate")) : null,
      category: fs(e, "category"),
      date: new Date(fs(e, "date")),
      notes: fsn(e, "notes"),
      attachmentFileName: fileFieldName(e, "attachment"),
      splitMethod: fs(e, "split_method"),
      paidById: relId(e, "paid_by"),
      paidBy: {
        id: paidBy.id,
        name: fsn(paidBy, "name"),
        email: recordEmail(paidBy),
        avatarUrl: paidAv ? pb.files.getUrl(paidBy as Record<string, unknown>, paidAv) : null,
      },
      participants: plist.map((p) => {
        const u = p.expand?.user as RecordModel;
        const sh = recordField(p, "shares");
        const shares =
          typeof sh === "number" ? sh : sh != null && sh !== "" ? Number(sh) : null;
        const pct = fsn(p, "percentage");
        const uAv = fsn(u, "avatar");
        return {
          id: p.id,
          userId: relId(p, "user"),
          amount: toNumber(fs(p, "amount")),
          shares,
          percentage: pct ? toNumber(pct) : null,
          user: {
            id: u.id,
            name: fsn(u, "name"),
            email: recordEmail(u),
            avatarUrl: uAv ? pb.files.getUrl(u as Record<string, unknown>, uAv) : null,
          },
        };
      }),
    };
  });

  const settlements = bundle.settlements.map((s) => {
    const from = s.expand?.from_user as RecordModel;
    const to = s.expand?.to_user as RecordModel;
    const fromAv = fsn(from, "avatar");
    const toAv = fsn(to, "avatar");
    return {
      id: s.id,
      fromId: relId(s, "from_user"),
      toId: relId(s, "to_user"),
      amount: toNumber(fs(s, "amount")),
      currency: fs(s, "currency"),
      notes: fsn(s, "notes"),
      settledAt: new Date(fs(s, "settled_at")),
      from: {
        name: fsn(from, "name"),
        email: recordEmail(from),
        avatarUrl: fromAv ? pb.files.getUrl(from as Record<string, unknown>, fromAv) : null,
      },
      to: {
        name: fsn(to, "name"),
        email: recordEmail(to),
        avatarUrl: toAv ? pb.files.getUrl(to as Record<string, unknown>, toAv) : null,
      },
    };
  });

  const balancesMap = calculateBalances({
    memberIds,
    expenses: expenses.map((e) => ({
      paidById: e.paidById,
      participants: e.participants.map((p) => ({
        userId: p.userId,
        amount: p.amount,
      })),
    })),
    settlements: settlements.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: s.amount,
    })),
  });

  const suggestions = minimizeDebts(balancesMap);

  return {
    role: fs(membership, "role"),
    currentUserId: userId,
    group: {
      id: g.id,
      name: fs(g, "name"),
      description: fsn(g, "description"),
      category: fs(g, "category"),
      currency: fs(g, "currency"),
    },
    members: memberRows,
    invitations: bundle.invitations.map((i) => ({
      id: i.id,
      email: fsn(i, "email"),
      status: fs(i, "status"),
      expiresAt: new Date(fs(i, "expires_at")).toISOString(),
    })),
    expenses,
    balances: memberIds.map((uid) => {
      const m = memberRows.find((x) => x.userId === uid)!;
      return {
        userId: uid,
        name: m.name,
        email: m.email,
        balance: balancesMap[uid] ?? 0,
      };
    }),
    suggestions: suggestions.map((s) => ({
      fromId: s.fromId,
      toId: s.toId,
      amount: s.amount,
      fromName:
        memberRows.find((m) => m.userId === s.fromId)?.name ??
        memberRows.find((m) => m.userId === s.fromId)?.email ??
        "",
      toName:
        memberRows.find((m) => m.userId === s.toId)?.name ??
        memberRows.find((m) => m.userId === s.toId)?.email ??
        "",
    })),
    settlements,
  };
}
