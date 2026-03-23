import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, ".env.local") });

/**
 * Removes groups created by E2E so the next run starts clean.
 * Cascades expenses, settlements, memberships per Prisma schema.
 */
export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { count } = await prisma.group.deleteMany({
      where: { name: { startsWith: "E2E-AUT-" } },
    });
    // eslint-disable-next-line no-console
    console.log(`[e2e teardown] Deleted ${count} group(s) matching E2E-AUT-*`);
  } finally {
    await prisma.$disconnect();
  }
}
