import type { User as AuthUser } from "@supabase/supabase-js";
import type { User as AppUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

/**
 * When Supabase auth user id does not match our `users.id` but email matches,
 * re-point all FKs from the old row to the current auth id, then remove the orphan row.
 * Uses a temporary email on insert to satisfy UNIQUE(email) while migrating.
 */
async function reassignUserIdToAuthId(
  oldId: string,
  authId: string,
  email: string,
  name: string | null
): Promise<void> {
  const tempEmail = `__merge_${authId.slice(0, 8)}_${Date.now()}@splitmyway.local`;

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: authId,
        email: tempEmail,
        name,
        currency: "USD",
      },
    });

    await tx.groupMember.updateMany({ where: { userId: oldId }, data: { userId: authId } });
    await tx.expense.updateMany({ where: { paidById: oldId }, data: { paidById: authId } });
    await tx.expenseParticipant.updateMany({ where: { userId: oldId }, data: { userId: authId } });
    await tx.settlement.updateMany({ where: { fromId: oldId }, data: { fromId: authId } });
    await tx.settlement.updateMany({ where: { toId: oldId }, data: { toId: authId } });
    await tx.activityLog.updateMany({ where: { userId: oldId }, data: { userId: authId } });
    await tx.invitation.updateMany({ where: { invitedBy: oldId }, data: { invitedBy: authId } });

    await tx.user.delete({ where: { id: oldId } });
    await tx.user.update({
      where: { id: authId },
      data: { email, name },
    });
  });
}

/**
 * Returns the app `User` row aligned with Supabase auth (by id, or by email merge).
 */
export async function ensureAppUserForAuth(user: AuthUser): Promise<AppUser> {
  const email = normalizeEmail(user.email ?? "");
  if (!email) {
    throw new Error("Auth user has no email");
  }

  const byId = await prisma.user.findUnique({ where: { id: user.id } });
  if (byId) {
    if (normalizeEmail(byId.email) !== email) {
      return prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          name: (user.user_metadata?.name as string | undefined) ?? byId.name,
        },
      });
    }
    return byId;
  }

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (byEmail) {
    if (byEmail.id === user.id) {
      return byEmail;
    }
    const name = (user.user_metadata?.name as string | undefined) ?? byEmail.name;
    await reassignUserIdToAuthId(byEmail.id, user.id, email, name ?? null);
    const merged = await prisma.user.findUnique({ where: { id: user.id } });
    if (!merged) throw new Error("Failed to merge app user with auth");
    return merged;
  }

  return prisma.user.create({
    data: {
      id: user.id,
      email,
      name: (user.user_metadata?.name as string | undefined) ?? null,
      currency: "USD",
    },
  });
}
