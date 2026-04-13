/**
 * Cloudflare D1 caps BLOB/TEXT/cell at ~2 MB (SQLITE_TOOBIG beyond that).
 * Keep expense attachments under this; sync with `src/lib/constants.ts`.
 *
 * @see https://developers.cloudflare.com/d1/platform/limits/
 */
export const MAX_EXPENSE_ATTACHMENT_BYTES = Math.floor(1.5 * 1024 * 1024);

/** User-visible validation (matches Next.js `MAX_EXPENSE_ATTACHMENT_LABEL`). */
export const MAX_EXPENSE_ATTACHMENT_ERROR =
  "Receipt must be 1.5 MB or smaller (database storage limit). Use a smaller file or leave attachment empty.";
