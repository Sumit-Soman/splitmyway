/**
 * PocketBase API base must be origin only (e.g. http://127.0.0.1:8090).
 * Strips mistaken paths like /_/ (admin UI) or /api from POCKETBASE_URL.
 */
export function normalizePocketBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return "";
  const s = raw.trim();
  try {
    return new URL(s).origin;
  } catch {
    return s.replace(/\/$/, "");
  }
}
