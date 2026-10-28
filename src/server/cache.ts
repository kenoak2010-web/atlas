/**
 * Small in-memory cache for provider results.
 *
 * - TTL based on provider refresh interval
 * - de-duplicates concurrent requests for the same key
 * - exponential backoff after upstream failures (protects rate limits)
 * - keeps the last good value so callers can serve it labelled as "cached"
 *
 * On serverless hosts each instance has its own memory; CDN caching via
 * Cache-Control headers (see the API route) provides cross-instance reuse.
 */

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  sourceUpdatedAt: string | null;
}

interface KeyState<T> {
  good?: CacheEntry<T>;
  inflight?: Promise<CacheEntry<T> | null>;
  failures: number;
  lastError?: string;
  lastErrorAt?: number;
  retryAfter: number;
}

export interface CacheResult<T> {
  entry: CacheEntry<T> | null;
  /** true when `entry` is older than its TTL because the refresh failed */
  stale: boolean;
  error: string | null;
}

const MAX_KEYS = 500;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export class TtlCache {
  private states = new Map<string, KeyState<unknown>>();

  constructor(private now: () => number = Date.now) {}

  backoffMs(failures: number): number {
    if (failures <= 0) return 0;
    return Math.min(BASE_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS);
  }

  async get<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<{ value: T; sourceUpdatedAt?: string | null }>,
  ): Promise<CacheResult<T>> {
    let state = this.states.get(key) as KeyState<T> | undefined;
    if (!state) {
      state = { failures: 0, retryAfter: 0 };
      this.states.set(key, state as KeyState<unknown>);
      this.evict();
    }
    const now = this.now();

    if (state.good && now - state.good.fetchedAt < ttlMs) {
      return { entry: state.good ?? null, stale: false, error: null };
    }
    if (now < state.retryAfter) {
      return { entry: state.good ?? null, stale: true, error: state.lastError ?? "Upstream temporarily unavailable" };
    }

    if (!state.inflight) {
      const s = state;
      // Success and failure bookkeeping happen once here, not once per waiter.
      s.inflight = loader()
        .then((r) => {
          const entry: CacheEntry<T> = { value: r.value, fetchedAt: this.now(), sourceUpdatedAt: r.sourceUpdatedAt ?? null };
          s.good = entry;
          s.failures = 0;
          s.retryAfter = 0;
          s.lastError = undefined;
          return entry;
        })
        .catch((err: unknown) => {
          s.failures += 1;
          s.lastError = err instanceof Error ? err.message : String(err);
          s.lastErrorAt = this.now();
          s.retryAfter = this.now() + this.backoffMs(s.failures);
          return null;
        })
        .finally(() => {
          s.inflight = undefined;
        });
    }

    const entry = await state.inflight;
    if (entry) return { entry, stale: false, error: null };
    return { entry: state.good ?? null, stale: true, error: state.lastError ?? "Upstream error" };
  }

  private evict() {
    if (this.states.size <= MAX_KEYS) return;
    const oldest = this.states.keys().next().value;
    if (oldest !== undefined) this.states.delete(oldest);
  }
}
