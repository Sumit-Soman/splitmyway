import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@splitmyway.local";
  const userId = "00000000-0000-4000-8000-000000000001";
  const user2Id = "00000000-0000-4000-8000-000000000002";

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name: "Demo User",
      currency: "USD",
    },
    update: { name: "Demo User" },
  });

  await prisma.user.upsert({
    where: { id: user2Id },
    create: {
      id: user2Id,
      email: "friend@splitmyway.local",
      name: "Friend User",
      currency: "USD",
    },
    update: {},
  });

  const group = await prisma.group.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    create: {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Weekend Trip",
      description: "Demo group",
      category: "trip",
      currency: "USD",
    },
    update: {},
  });

  await prisma.groupMember.upsert({
    where: {
      userId_groupId: { userId, groupId: group.id },
    },
    create: { userId, groupId: group.id, role: "admin" },
    update: {},
  });

  await prisma.groupMember.upsert({
    where: {
      userId_groupId: { userId: user2Id, groupId: group.id },
    },
    create: { userId: user2Id, groupId: group.id, role: "member" },
    update: {},
  });

  const existing = await prisma.expense.findFirst({
    where: { groupId: group.id, description: "Dinner demo" },
  });
  if (!existing) {
    const expense = await prisma.expense.create({
      data: {
        groupId: group.id,
        paidById: userId,
        description: "Dinner demo",
        amount: new Decimal("60.00"),
        currency: "USD",
        category: "food",
        splitMethod: "equal",
        participants: {
          create: [
            { userId, amount: new Decimal("30.00") },
            { userId: user2Id, amount: new Decimal("30.00") },
          ],
        },
      },
    });
    await prisma.activityLog.create({
      data: {
        userId,
        groupId: group.id,
        type: "expense_added",
        metadata: { expenseId: expense.id, description: expense.description },
      },
    });
  }

  console.log("Seed complete. Demo users (create matching Supabase auth users to log in):");
  console.log(`  ${email} / password of your choice in Supabase`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
