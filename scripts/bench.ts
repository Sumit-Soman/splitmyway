/**
 * Measures DB-heavy paths (dashboard-style loads + create group).
 * Run: npx tsx --env-file=.env scripts/bench.ts
 */
import PocketBase from "pocketbase";
import { loadGroupsDataForUser } from "../src/lib/pocketbase/queries";

async function getAdminPb() {
  const url = process.env.POCKETBASE_URL;
  if (!url) throw new Error("POCKETBASE_URL");
  const pb = new PocketBase(url);
  await pb.admins.authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL!,
    process.env.POCKETBASE_ADMIN_PASSWORD!
  );
  return pb;
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`  ${label}: ${(performance.now() - t0).toFixed(1)} ms`);
  }
}

async function main() {
  const pb = await getAdminPb();
  const users = await pb.collection("users").getList(1, 1, { sort: "created" });
  const user = users.items[0];
  if (!user) {
    console.log("No users in PocketBase — seed or sign up once, then re-run.");
    process.exit(1);
  }

  console.log(`\nBenchmark (user ${user.email})\n`);

  await time("loadGroupsDataForUser", () => loadGroupsDataForUser(user.id));

  await time("getRecentActivity", async () => {
    // Uses getAuthUser internally — won't work without cookies; measure query path only:
    const memberships = await pb.collection("group_members").getFullList({
      filter: `user = "${user.id}"`,
    });
    const groupIds = memberships.map((m) => m.get("group") as string);
    const orGroups =
      groupIds.length === 0
        ? ""
        : groupIds.length === 1
          ? `group = "${groupIds[0]}"`
          : `(${groupIds.map((id) => `group = "${id}"`).join(" || ")})`;
    const filter = groupIds.length === 0 ? `user = "${user.id}"` : `(user = "${user.id}" || ${orGroups})`;
    return pb.collection("activity_logs").getFullList({
      filter,
      sort: "-created",
      perPage: 10,
      expand: "user,group",
    });
  });

  const slug = `bench-${Date.now()}`;
  await time("createGroup-style writes", async () => {
    const g = await pb.collection("groups").create({
      name: slug,
      description: "benchmark",
      category: "other",
      currency: "USD",
    });
    await pb.collection("group_members").create({
      user: user.id,
      group: g.id,
      role: "admin",
      joined_at: new Date().toISOString(),
    });
    await pb.collection("activity_logs").create({
      user: user.id,
      group: g.id,
      type: "group_created",
      metadata: { groupName: g.get("name") },
    });
    await pb.collection("groups").delete(g.id);
    console.log("  (removed benchmark group)");
  });

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
