/**
 * Dev-only timing logs. Set SPLITMYWAY_PERF=1 to print in production builds too.
 */
const enabled = () =>
  process.env.NODE_ENV === "development" || process.env.SPLITMYWAY_PERF === "1";

export async function perf<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - t0;
    console.log(`[splitmyway:perf] ${label}: ${ms.toFixed(1)}ms`);
  }
}
