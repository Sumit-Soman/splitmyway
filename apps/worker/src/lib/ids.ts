const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** PocketBase-style 15-char lowercase ids for stable URLs and PB migration. */
export function genRecordId(): string {
  const out: string[] = [];
  const buf = new Uint8Array(15);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 15; i++) {
    out.push(ALPHABET[buf[i]! % ALPHABET.length]!);
  }
  return out.join("");
}

export function nowIso(): string {
  return new Date().toISOString();
}
