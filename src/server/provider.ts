import type { z } from "zod";
import type { Attribution, Freshness } from "@/lib/types";

/**
 * How a provider's data should be labelled when it was fetched successfully:
 * - "live": positions/streams that are near real-time (aircraft, ISS)
 * - "periodic": feeds refreshed every few minutes (earthquakes, news)
 * - "delayed": data that is inherently delayed (end-of-day FX, weekly reports)
 */
export type FreshnessClass = "live" | "periodic" | "delayed";

export interface ProviderResult<T> {
  data: T;
  /** Newest timestamp contained in the upstream data, if known */
  sourceUpdatedAt?: string | null;
}

export interface ProviderContext {
  signal?: AbortSignal;
  env: Record<string, string | undefined>;
}

export interface Provider<P, T> {
  id: string;
  label: string;
  category: string;
  /** Server cache TTL & suggested client polling interval */
  refreshSeconds: number;
  freshnessClass: FreshnessClass;
  attribution: Attribution;
  /** Documented upstream rate limit, shown in the source registry */
  rateLimit: string;
  /** Environment variable that must be present, if any */
  requiresKey?: string;
  note?: string;
  params: z.ZodType<P>;
  cacheKey(params: P): string;
  fetch(params: P, ctx: ProviderContext): Promise<ProviderResult<T>>;
}

// Helper so adapters get full type inference with a single call.
export function defineProvider<P, T>(p: Provider<P, T>): Provider<P, T> {
  return p;
}

export function freshnessFor(cls: FreshnessClass, fetchedAtMs: number, refreshSeconds: number, now = Date.now()): Freshness {
  if (cls === "delayed") return "delayed";
  const age = (now - fetchedAtMs) / 1000;
  if (cls === "live" && age <= Math.max(refreshSeconds * 2, 60)) return "live";
  if (age <= Math.max(refreshSeconds * 3, 300)) return "recent";
  return "cached";
}
