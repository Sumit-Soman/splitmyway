/**
 * PocketBase returns `RecordModel` instances with `.get()`, but `authStore.record`
 * loaded from cookies is often a plain object — support both.
 *
 * Prefer direct property access when the key exists on the object: some SDK paths
 * expose fields (e.g. new file columns) on the record before `.get()` sees them.
 */
export function recordField(r: unknown, key: string): unknown {
  if (r == null || typeof r !== "object") return undefined;
  const o = r as Record<string, unknown> & { get?: (k: string) => unknown };
  if (key in o) {
    return o[key];
  }
  if (typeof o.get === "function") {
    return o.get(key);
  }
  return o[key];
}

/** Single file field: value is a filename string or occasionally a one-file array. */
export function fileFieldName(r: unknown, key: string): string | null {
  const v = recordField(r, key);
  if (v == null || v === "") return null;
  if (Array.isArray(v)) {
    const first = v[0];
    return first != null && String(first).trim() !== "" ? String(first) : null;
  }
  const s = String(v).trim();
  return s || null;
}
