/** Strip wildcards; max length. Returns null if search should not run. */
export function sanitizeMemberSearchRaw(query: string): string | null {
  const raw = query.trim().replace(/[%_\\]/g, "").slice(0, 48);
  return raw.length < 3 ? null : raw;
}
