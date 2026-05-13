/**
 * D1 BLOB columns are not consistently typed on read: you may get `ArrayBuffer`,
 * an `ArrayBuffer` view, or a byte `number[]` (see cloudflare/workers-sdk#8642).
 */
export function d1BlobToUint8Array(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  if (raw instanceof ArrayBuffer) {
    return raw.byteLength > 0 ? new Uint8Array(raw) : null;
  }
  if (ArrayBuffer.isView(raw)) {
    const v = raw;
    return v.byteLength > 0 ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : null;
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return Uint8Array.from(raw as number[], (n) => Number(n) & 0xff);
  }
  return null;
}
