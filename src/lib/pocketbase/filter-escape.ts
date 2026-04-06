/** Escape double quotes for PocketBase filter strings. */
export function escapeFilterValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
