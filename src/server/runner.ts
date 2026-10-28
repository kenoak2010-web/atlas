import "server-only";
import { TtlCache } from "./cache";
import { freshnessFor, type Provider } from "./provider";
import { PROVIDERS } from "./registry";
import type { ProviderEnvelope, ProviderHealth } from "@/lib/types";

const cache = new TtlCache();

interface HealthState {
  lastSuccess: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  consecutiveFailures: number;
}
const health = new Map<string, HealthState>();

function h(id: string): HealthState {
  let s = health.get(id);
  if (!s) health.set(id, (s = { lastSuccess: null, lastError: null, lastErrorAt: null, consecutiveFailures: 0 }));
  return s;
}

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

export async function runProvider<P, T>(provider: Provider<P, T>, params: P): Promise<ProviderEnvelope<T>> {
  const base = {
    provider: provider.id,
    label: provider.label,
    attribution: provider.attribution,
    refreshSeconds: provider.refreshSeconds,
    note: provider.note,
  };
  if (provider.requiresKey && !process.env[provider.requiresKey]) {
    return {
      ...base,
      data: null,
      fetchedAt: null,
      sourceUpdatedAt: null,
      freshness: "unavailable",
      error: `Not configured: set ${provider.requiresKey} (free) on the server to enable this source.`,
    };
  }

  const key = `${provider.id}:${provider.cacheKey(params)}`;
  const result = await cache.get(key, provider.refreshSeconds * 1000, async () => {
    const r = await provider.fetch(params, { env: process.env });
    return { value: r.data, sourceUpdatedAt: r.sourceUpdatedAt ?? null };
  });

  const hs = h(provider.id);
  if (result.error) {
    hs.consecutiveFailures += 1;
    hs.lastError = result.error;
    hs.lastErrorAt = Date.now();
    console.warn(`[atlas] provider ${provider.id} failed: ${result.error}`);
  } else if (result.entry) {
    hs.consecutiveFailures = 0;
    hs.lastSuccess = result.entry.fetchedAt;
  }

  if (!result.entry) {
    return { ...base, data: null, fetchedAt: null, sourceUpdatedAt: null, freshness: "unavailable", error: result.error ?? "No data" };
  }
  return {
    ...base,
    data: result.entry.value,
    fetchedAt: iso(result.entry.fetchedAt),
    sourceUpdatedAt: result.entry.sourceUpdatedAt,
    freshness: result.stale ? "cached" : freshnessFor(provider.freshnessClass, result.entry.fetchedAt, provider.refreshSeconds),
    error: result.error,
  };
}

export function providerHealth(): ProviderHealth[] {
  return PROVIDERS.map((p) => {
    const s = h(p.id);
    const configured = !p.requiresKey || !!process.env[p.requiresKey];
    let status: ProviderHealth["status"] = "idle";
    if (!configured) status = "not-configured";
    else if (s.consecutiveFailures >= 3) status = "down";
    else if (s.consecutiveFailures > 0) status = "degraded";
    else if (s.lastSuccess) status = "ok";
    return {
      id: p.id,
      label: p.label,
      category: p.category,
      status,
      lastSuccess: iso(s.lastSuccess),
      lastError: s.lastError,
      lastErrorAt: iso(s.lastErrorAt),
      consecutiveFailures: s.consecutiveFailures,
      refreshSeconds: p.refreshSeconds,
      requiresKey: p.requiresKey ?? null,
      attribution: p.attribution,
      rateLimit: p.rateLimit,
      note: p.note,
    };
  });
}
