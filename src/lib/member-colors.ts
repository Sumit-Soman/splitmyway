/** Stable hash → index for consistent per-user colors across the UI. */
export function memberColorIndex(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul(31, h) + userId.charCodeAt(i);
  }
  return Math.abs(h) % MEMBER_PALETTE.length;
}

/** Distinct, accessible tints for avatars, dots, and row accents. */
export const MEMBER_PALETTE = [
  {
    ring: "ring-emerald-500/35",
    fallback: "bg-emerald-100 text-emerald-900",
    dot: "bg-emerald-500",
    border: "border-l-4 border-emerald-500",
    rowBg: "bg-emerald-50/60",
  },
  {
    ring: "ring-sky-500/40",
    fallback: "bg-sky-100 text-sky-900",
    dot: "bg-sky-500",
    border: "border-l-4 border-sky-500",
    rowBg: "bg-sky-50/60",
  },
  {
    ring: "ring-violet-500/35",
    fallback: "bg-violet-100 text-violet-900",
    dot: "bg-violet-500",
    border: "border-l-4 border-violet-500",
    rowBg: "bg-violet-50/60",
  },
  {
    ring: "ring-amber-500/40",
    fallback: "bg-amber-100 text-amber-900",
    dot: "bg-amber-500",
    border: "border-l-4 border-amber-500",
    rowBg: "bg-amber-50/60",
  },
  {
    ring: "ring-rose-500/35",
    fallback: "bg-rose-100 text-rose-900",
    dot: "bg-rose-500",
    border: "border-l-4 border-rose-500",
    rowBg: "bg-rose-50/60",
  },
  {
    ring: "ring-cyan-500/40",
    fallback: "bg-cyan-100 text-cyan-900",
    dot: "bg-cyan-500",
    border: "border-l-4 border-cyan-500",
    rowBg: "bg-cyan-50/60",
  },
  {
    ring: "ring-indigo-500/35",
    fallback: "bg-indigo-100 text-indigo-900",
    dot: "bg-indigo-500",
    border: "border-l-4 border-indigo-500",
    rowBg: "bg-indigo-50/60",
  },
  {
    ring: "ring-fuchsia-500/35",
    fallback: "bg-fuchsia-100 text-fuchsia-900",
    dot: "bg-fuchsia-500",
    border: "border-l-4 border-fuchsia-500",
    rowBg: "bg-fuchsia-50/60",
  },
] as const;

export function getMemberPalette(userId: string) {
  return MEMBER_PALETTE[memberColorIndex(userId)]!;
}
