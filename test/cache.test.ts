import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/server/cache";
import { freshnessFor } from "@/server/provider";

describe("TtlCache", () => {
  it("serves cached value within TTL and refetches after expiry", async () => {
    let now = 0;
    const cache = new TtlCache(() => now);
    const loader = vi.fn(async () => ({ value: now }));
    expect((await cache.get("k", 1000, loader)).entry?.value).toBe(0);
    now = 500;
    expect((await cache.get("k", 1000, loader)).entry?.value).toBe(0);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 1500;
    expect((await cache.get("k", 1000, loader)).entry?.value).toBe(1500);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("de-duplicates concurrent requests", async () => {
    const cache = new TtlCache();
    let resolve!: (v: { value: number }) => void;
    const loader = vi.fn(() => new Promise<{ value: number }>((r) => (resolve = r)));
    const a = cache.get("k", 1000, loader);
    const b = cache.get("k", 1000, loader);
    resolve({ value: 42 });
    expect((await a).entry?.value).toBe(42);
    expect((await b).entry?.value).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves stale data with error after a failure and backs off", async () => {
    let now = 0;
    const cache = new TtlCache(() => now);
    await cache.get("k", 1000, async () => ({ value: "good" }));
    now = 2000;
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await cache.get("k", 1000, failing);
    expect(r.stale).toBe(true);
    expect(r.entry?.value).toBe("good");
    expect(r.error).toBe("boom");
    // Within backoff window the loader is not called again.
    now = 2000 + 5_000;
    await cache.get("k", 1000, failing);
    expect(failing).toHaveBeenCalledTimes(1);
    now = 2000 + 16_000;
    await cache.get("k", 1000, failing);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("returns null entry when nothing was ever fetched", async () => {
    const cache = new TtlCache();
    const r = await cache.get("x", 1000, async () => {
      throw new Error("down");
    });
    expect(r.entry).toBeNull();
    expect(r.error).toBe("down");
  });

  it("caps exponential backoff", () => {
    const c = new TtlCache();
    expect(c.backoffMs(1)).toBe(15_000);
    expect(c.backoffMs(2)).toBe(30_000);
    expect(c.backoffMs(20)).toBe(15 * 60_000);
  });
});

describe("freshnessFor", () => {
  it("labels honestly", () => {
    const now = 1_000_000;
    expect(freshnessFor("delayed", now, 60, now)).toBe("delayed");
    expect(freshnessFor("live", now - 20_000, 10, now)).toBe("live");
    expect(freshnessFor("periodic", now - 20_000, 60, now)).toBe("recent");
    expect(freshnessFor("live", now - 3_600_000, 10, now)).toBe("cached");
  });
});
