/**
 * Measures DB-heavy paths (same shapes as dashboard + createGroup).
 * Run: npx tsx --env-file=.env scripts/bench.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`  ${label}: ${(performance.now() - t0).toFixed(1)} ms`);
  }
}

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.log("No users in DB — seed or sign up once, then re-run.");
    process.exit(1);
  }

  console.log(`\nBenchmark (user ${user.email})\n`);

  await time("Dashboard-style group.findMany (full include)", () =>
    prisma.group.findMany({
      where: { members: { some: { userId: user.id } } },
      include: {
        members: { include: { user: true } },
        expenses: { include: { participants: true } },
        settlements: true,
      },
    })
  );

  await time("Activity: memberships + activityLog", async () => {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    return prisma.activityLog.findMany({
      where: {
        OR: [{ userId: user.id }, { groupId: { in: groupIds } }],
      },
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  const slug = `bench-${Date.now()}`;
  await time("createGroup-style transaction", () =>
    prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name: slug,
          description: "benchmark",
          category: "other",
          currency: "USD",
        },
      });
      await tx.groupMember.create({
        data: { userId: user.id, groupId: g.id, role: "admin" },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          groupId: g.id,
          type: "group_created",
          metadata: { groupName: g.name },
        },
      });
      return g;
    })
  );

  const created = await prisma.group.findFirst({ where: { name: slug } });
  if (created) {
    await prisma.group.delete({ where: { id: created.id } });
    console.log("  (removed benchmark group)");
  }

  console.log("");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
