"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getRecentActivity(limit = 10) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [{ userId: user.id }, { groupId: { in: groupIds } }],
    },
    include: {
      user: { select: { name: true, email: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map((l) => ({
    id: l.id,
    type: l.type,
    metadata: l.metadata,
    createdAt: l.createdAt.toISOString(),
    user: l.user,
    groupName: l.group?.name ?? null,
    groupId: l.groupId,
  }));
}
