import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && process.env.SPLITMYWAY_PERF === "1"
        ? ["error", "warn", "query"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
  });

/** Reuse one client per Node isolate (dev + Vercel warm invocations). */
globalForPrisma.prisma = prisma;
