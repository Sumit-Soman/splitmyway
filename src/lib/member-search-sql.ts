import { Prisma } from "@prisma/client";

/** Strip ILIKE wildcards; max length. Returns null if search should not run. */
export function sanitizeMemberSearchRaw(query: string): string | null {
  const raw = query.trim().replace(/[%_\\]/g, "").slice(0, 48);
  return raw.length < 3 ? null : raw;
}

/** Same `WHERE` fragment as `searchGroupMemberCandidates` (table alias `u`). */
export function memberSearchMatchSql(raw: string): Prisma.Sql {
  const pattern = `${raw}%`;
  const emailLocalPattern = `${raw.toLowerCase()}%`;
  const containsPattern = `%${raw}%`;

  const nameMatchSql = Prisma.sql`(
      COALESCE(TRIM(u.name), '') <> ''
      AND (
        split_part(regexp_replace(trim(COALESCE(u.name, '')), '[[:space:]]+', ' ', 'g'), ' ', 1) ILIKE ${pattern}
        OR trim(u.name) ILIKE ${pattern}
        OR trim(u.name) ILIKE ${containsPattern}
      )
    )`;
  const emailMatchSql = Prisma.sql`(lower(split_part(u.email, '@', 1)) LIKE ${emailLocalPattern})`;
  return Prisma.sql`(${nameMatchSql} OR ${emailMatchSql})`;
}
