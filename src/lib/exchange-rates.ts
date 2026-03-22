type CacheEntry = { rates: Record<string, number>; fetchedAt: number };

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function getExchangeRates(base: string): Promise<Record<string, number>> {
  const upper = base.toUpperCase();
  const now = Date.now();
  const hit = cache.get(upper);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.rates;
  }

  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(upper)}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch exchange rates for ${upper}`);
  }
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rates = data.rates ?? {};
  cache.set(upper, { rates, fetchedAt: now });
  return rates;
}

export async function getRate(from: string, to: string): Promise<number> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;
  const rates = await getExchangeRates(f);
  const rate = rates[t];
  if (rate === undefined) {
    throw new Error(`No rate found for ${f} → ${t}`);
  }
  return rate;
}
