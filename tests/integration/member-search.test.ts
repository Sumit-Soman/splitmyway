/**
 * Verifies member search SQL against Postgres (same predicates as add-member picker).
 * Opt-in: SPLITMYWAY_INTEGRATION=1 npm run test:integration -- tests/integration/member-search.test.ts
 */
import { describe, it, expect, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { memberSearchMatchSql, sanitizeMemberSearchRaw } from "@/lib/member-search-sql";

const RUN = process.env.SPLITMYWAY_INTEGRATION === "1";

async function runSearchQuery(opts: {
  searcherId: string;
  memberIds: string[];
  query: string;
}): Promise<{ id: string; email: string; name: string | null }[]> {
  const raw = sanitizeMemberSearchRaw(opts.query);
  if (!raw) return [];
  const matchSql = memberSearchMatchSql(raw);
  if (opts.memberIds.length === 0) {
    return prisma.$queryRaw<
      { id: string; name: string | null; email: string; avatar_url: string | null }[]
    >(Prisma.sql`
      SELECT u.id, u.name, u.email, u.avatar_url
      FROM users u
      WHERE ${matchSql}
        AND u.id::text <> ${opts.searcherId}::text
      ORDER BY u.name ASC NULLS LAST
      LIMIT 12
    `);
  }
  return prisma.$queryRaw<
    { id: string; name: string | null; email: string; avatar_url: string | null }[]
  >(Prisma.sql`
    SELECT u.id, u.name, u.email, u.avatar_url
    FROM users u
    WHERE ${matchSql}
      AND u.id::text <> ${opts.searcherId}::text
      AND u.id::text NOT IN (${Prisma.join(opts.memberIds)})
    ORDER BY u.name ASC NULLS LAST
    LIMIT 12
  `);
}

describe.skipIf(!RUN)("member search SQL (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("finds Tamil Selvan by first name Tamil (normal space)", async () => {
    const tag = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `admin-${tag}@integration.test`, name: "Admin", currency: "USD" },
    });
    const tamil = await prisma.user.create({
      data: { email: `tamil-${tag}@integration.test`, name: "Tamil Selvan", currency: "USD" },
    });
    const group = await prisma.group.create({
      data: { name: `G ${tag}`, category: "other", currency: "USD" },
    });
    await prisma.groupMember.create({
      data: { userId: admin.id, groupId: group.id, role: "admin" },
    });
    try {
      const rows = await runSearchQuery({
        searcherId: admin.id,
        memberIds: [admin.id],
        query: "Tamil",
      });
      const hit = rows.find((r) => r.id === tamil.id);
      expect(hit?.name).toBe("Tamil Selvan");
    } finally {
      await prisma.groupMember.deleteMany({ where: { groupId: group.id } });
      await prisma.group.delete({ where: { id: group.id } });
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, tamil.id] } } });
    }
  });

  it("finds name when words are separated by NBSP (Unicode space)", async () => {
    const tag = `ms-nbsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `adm2-${tag}@integration.test`, name: "Admin", currency: "USD" },
    });
    const tamil = await prisma.user.create({
      data: {
        email: `tam2-${tag}@integration.test`,
        name: `Tamil\u00A0Selvan`,
        currency: "USD",
      },
    });
    const group = await prisma.group.create({
      data: { name: `G2 ${tag}`, category: "other", currency: "USD" },
    });
    await prisma.groupMember.create({
      data: { userId: admin.id, groupId: group.id, role: "admin" },
    });
    try {
      const rows = await runSearchQuery({
        searcherId: admin.id,
        memberIds: [admin.id],
        query: "Tamil",
      });
      expect(rows.some((r) => r.id === tamil.id)).toBe(true);
    } finally {
      await prisma.groupMember.deleteMany({ where: { groupId: group.id } });
      await prisma.group.delete({ where: { id: group.id } });
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, tamil.id] } } });
    }
  });

  it("matches email local-part when name is null", async () => {
    const tag = `ms-em-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const admin = await prisma.user.create({
      data: { email: `adm3-${tag}@integration.test`, name: "Admin", currency: "USD" },
    });
    const noName = await prisma.user.create({
      data: { email: `tamilfriend-${tag}@integration.test`, name: null, currency: "USD" },
    });
    const group = await prisma.group.create({
      data: { name: `G3 ${tag}`, category: "other", currency: "USD" },
    });
    await prisma.groupMember.create({
      data: { userId: admin.id, groupId: group.id, role: "admin" },
    });
    try {
      const rows = await runSearchQuery({
        searcherId: admin.id,
        memberIds: [admin.id],
        query: "tamilfriend",
      });
      expect(rows.some((r) => r.id === noName.id)).toBe(true);
    } finally {
      await prisma.groupMember.deleteMany({ where: { groupId: group.id } });
      await prisma.group.delete({ where: { id: group.id } });
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, noName.id] } } });
    }
  });

  it("sanitizeMemberSearchRaw rejects short queries", () => {
    expect(sanitizeMemberSearchRaw("Ta")).toBeNull();
    expect(sanitizeMemberSearchRaw("Tam")).toBe("Tam");
  });
});
