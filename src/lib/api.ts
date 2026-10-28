"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Freshness, ProviderEnvelope } from "./types";
import { usePrefs } from "./store";

export class ApiError extends Error {}

export interface ClientEnvelope<T> extends ProviderEnvelope<T> {
  /** true when the response came from the service-worker cache (offline) */
  fromOfflineCache: boolean;
}

type Params = Record<string, string | number | undefined | null>;

export function buildUrl(provider: string, params?: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `/api/data/${provider}${s ? `?${s}` : ""}`;
}

export async function fetchProvider<T>(provider: string, params?: Params, signal?: AbortSignal): Promise<ClientEnvelope<T>> {
  const res = await fetch(buildUrl(provider, params), { signal });
  if (!res.ok && res.status !== 200) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `HTTP ${res.status}`);
  }
  const env = (await res.json()) as ProviderEnvelope<T>;
  const fromOfflineCache = res.headers.get("x-atlas-offline") === "1";
  return { ...env, fromOfflineCache, freshness: fromOfflineCache && env.data ? "cached" : env.freshness };
}

/** Default polling multipliers for the user's refresh preference. */
function intervalFor(refreshSeconds: number, mode: string): number | false {
  if (mode === "manual") return false;
  const base = Math.max(refreshSeconds, 10) * 1000;
  return mode === "saver" ? base * 3 : base;
}

export function useProvider<T>(
  provider: string,
  params?: Params,
  opts: { enabled?: boolean; refreshSeconds?: number } = {},
): UseQueryResult<ClientEnvelope<T>, Error> {
  const mode = usePrefs((s) => s.refresh);
  return useQuery({
    queryKey: [provider, params ?? {}],
    queryFn: ({ signal }) => fetchProvider<T>(provider, params, signal),
    enabled: opts.enabled ?? true,
    // Polling pauses automatically while the page is hidden (refetchIntervalInBackground=false).
    refetchInterval: (q) => intervalFor(q.state.data?.refreshSeconds ?? opts.refreshSeconds ?? 300, mode),
    staleTime: (q) => ((q.state.data?.refreshSeconds ?? 60) * 1000) / 2,
    retry: 1,
  });
}

export function effectiveFreshness(env: ClientEnvelope<unknown> | undefined, online: boolean): Freshness {
  if (!env) return "unavailable";
  if (!online && env.data) return "cached";
  return env.freshness;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
