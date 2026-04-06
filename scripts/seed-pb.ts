/**
 * Seed PocketBase with demo data and E2E-style test users.
 * Requires PocketBase running and admin credentials in .env.
 *
 * Run: npx tsx --env-file=.env scripts/seed-pb.ts
 *
 * Logins (app /users auth at /login):
 *   - demo@splitmyway.local / demo-demo-demo
 *   - friend@splitmyway.local / demo-demo-demo
 *   - testuser@test.com / Test@123  (override with E2E_USER_A_*)
 *   - cooanju@gmail.com / Test@123  (override with E2E_USER_B_*)
 *
 * PocketBase **superuser** (admin UI at http://127.0.0.1:8090/_/):
 *   - Set in .env: POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD
 *   - Default dev: admin@splitmyway.local (see pb_migrations/1738000001_dev_superuser.js)
 */
import PocketBase from "pocketbase";
import { ACTIVITY_TYPES } from "../src/lib/constants";

const DEMO_ID = "00000000-0000-4000-8000-000000000001";
const FRIEND_ID = "00000000-0000-4000-8000-000000000002";
const GROUP_ID = "00000000-0000-4000-8000-000000000010";

type SeedUser = {
  id?: string;
  email: string;
  password: string;
  name: string;
};

function escapeFilterEmail(email: string) {
  return email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** PocketBase may return Record models or plain objects depending on SDK version. */
function recordField(r: unknown, key: string): string {
  const x = r as Record<string, unknown> & { get?: (k: string) => unknown };
  if (typeof x.get === "function") return String(x.get(key) ?? "");
  return String(x[key] ?? "");
}

function recordRel(r: unknown, key: string): string {
  return recordField(r, key);
}

function recordName(r: unknown): string {
  return recordField(r, "name");
}

async function ensureUser(pb: PocketBase, u: SeedUser): Promise<{ id: string }> {
  const rows = await pb.collection("users").getFullList({
    filter: `email = "${escapeFilterEmail(u.email.toLowerCase().trim())}"`,
    limit: 1,
  });
  if (rows[0]) {
    // Resync password so CSV imports / manual changes don’t leave E2E users on ImportTemp* only.
    await pb.collection("users").update(rows[0].id, {
      name: u.name,
      password: u.password,
      passwordConfirm: u.password,
    });
    return { id: rows[0].id };
  }

  const body: Record<string, unknown> = {
    email: u.email.toLowerCase().trim(),
    password: u.password,
    passwordConfirm: u.password,
    name: u.name,
    currency: "USD",
  };
  if (u.id) {
    body.id = u.id;
  }

  try {
    const created = await pb.collection("users").create(body);
    return { id: created.id };
  } catch (e) {
    // Retry without fixed id if PocketBase rejects custom id
    if (u.id) {
      delete body.id;
      const created = await pb.collection("users").create(body);
      return { id: created.id };
    }
    throw e;
  }
}

async function main() {
  const url = process.env.POCKETBASE_URL;
  if (!url) throw new Error("POCKETBASE_URL");
  const pb = new PocketBase(url);
  await pb.admins.authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );

  const pwE2EA = process.env.E2E_USER_A_PASSWORD ?? "Test@123";
  const pwE2EB = process.env.E2E_USER_B_PASSWORD ?? "Test@123";
  const emailA = process.env.E2E_USER_A_EMAIL ?? "testuser@test.com";
  const emailB = process.env.E2E_USER_B_EMAIL ?? "cooanju@gmail.com";

  const seedUsers: SeedUser[] = [
    { id: DEMO_ID, email: "demo@splitmyway.local", password: "demo-demo-demo", name: "Demo User" },
    { id: FRIEND_ID, email: "friend@splitmyway.local", password: "demo-demo-demo", name: "Friend User" },
    { email: emailA, password: pwE2EA, name: "Test User" },
    { email: emailB, password: pwE2EB, name: "Anju" },
  ];

  const demo = await ensureUser(pb, seedUsers[0]!);
  const friend = await ensureUser(pb, seedUsers[1]!);
  await ensureUser(pb, seedUsers[2]!);
  await ensureUser(pb, seedUsers[3]!);

  let group;
  try {
    group = await pb.collection("groups").getOne(GROUP_ID);
  } catch {
    try {
      group = await pb.collection("groups").create({
        id: GROUP_ID,
        name: "Weekend Trip",
        description: "Demo group",
        category: "trip",
        currency: "USD",
      });
    } catch {
      const allGroups = await pb.collection("groups").getFullList();
      const found = allGroups.find((g) => recordName(g) === "Weekend Trip");
      if (found) {
        group = found;
      } else {
        group = await pb.collection("groups").create({
          name: "Weekend Trip",
          description: "Demo group",
          category: "trip",
          currency: "USD",
        });
      }
    }
  }

  const gid = group.id;

  const allMemberships = await pb.collection("group_members").getFullList();
  const mems = allMemberships.filter((m) => recordRel(m, "group") === gid);
  const hasDemo = mems.some((m) => recordRel(m, "user") === demo.id);
  const hasFriend = mems.some((m) => recordRel(m, "user") === friend.id);
  if (!hasDemo) {
    await pb.collection("group_members").create({
      user: demo.id,
      group: gid,
      role: "admin",
      joined_at: new Date().toISOString(),
    });
  }
  if (!hasFriend) {
    await pb.collection("group_members").create({
      user: friend.id,
      group: gid,
      role: "member",
      joined_at: new Date().toISOString(),
    });
  }

  const allExpenses = await pb.collection("expenses").getFullList();
  const existingExp = allExpenses.filter(
    (e) => recordRel(e, "group") === gid && recordField(e, "description") === "Dinner demo"
  );

  if (existingExp.length === 0) {
    const expense = await pb.collection("expenses").create({
      group: gid,
      paid_by: demo.id,
      description: "Dinner demo",
      amount: "60.00",
      currency: "USD",
      original_amount: "",
      original_currency: "",
      exchange_rate: "",
      category: "food",
      date: new Date().toISOString(),
      notes: "",
      split_method: "equal",
    });

    await pb.collection("expense_participants").create({
      expense: expense.id,
      user: demo.id,
      amount: "30.00",
      shares: null,
      percentage: "",
    });
    await pb.collection("expense_participants").create({
      expense: expense.id,
      user: friend.id,
      amount: "30.00",
      shares: null,
      percentage: "",
    });

    await pb.collection("activity_logs").create({
      user: demo.id,
      group: gid,
      type: ACTIVITY_TYPES.EXPENSE_ADDED,
      metadata: { expenseId: expense.id, description: "Dinner demo" },
    });
  }

  // eslint-disable-next-line no-console
  const adminUi = `${url.replace(/\/$/, "")}/_/`;
  // eslint-disable-next-line no-console
  console.log(`
Seed complete.

App logins:
  demo@splitmyway.local     / demo-demo-demo
  friend@splitmyway.local   / demo-demo-demo
  ${emailA.padEnd(26)} / ${pwE2EA}
  ${emailB.padEnd(26)} / ${pwE2EB}

PocketBase admin UI: ${adminUi}
  Use POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD from .env
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
