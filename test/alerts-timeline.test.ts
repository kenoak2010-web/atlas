import { describe, expect, it } from "vitest";
import { deriveAlerts } from "@/lib/alerts";
import { buildTimeline, eventToItem, regionFromPoint } from "@/lib/timeline";
import { DEFAULT_PREFS } from "@/lib/store";
import { isOpen, EXCHANGES } from "@/lib/market-hours";
import { distanceKm } from "@/lib/geo";
import type { AtlasEvent } from "@/lib/types";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const quake = (mag: number, hoursAgo: number, lat = 35, lon = 139): AtlasEvent => ({
  id: `usgs:${mag}-${hoursAgo}`,
  category: "earthquake",
  title: `M ${mag} test`,
  point: { lat, lon, precision: "exact" },
  source: { name: "USGS" },
  time: new Date(NOW - hoursAgo * 3600_000).toISOString(),
  severity: mag >= 6 ? 3 : 1,
  meta: { magnitude: mag, depthKm: 10 },
});

describe("alerts", () => {
  it("applies the magnitude threshold and recency", () => {
    const a = deriveAlerts({ quakes: [quake(6.5, 1), quake(5.0, 1), quake(7, 30)], places: [] }, DEFAULT_PREFS.alerts, NOW);
    expect(a.map((x) => x.id)).toEqual(["quake:usgs:6.5-1"]);
  });
  it("raises regional alerts near saved places", () => {
    const places = [{ id: "p", name: "Tokio", lat: 35.68, lon: 139.69, radiusKm: 300 }];
    const a = deriveAlerts({ quakes: [quake(4.6, 2)], places }, DEFAULT_PREFS.alerts, NOW);
    expect(a.some((x) => x.kind === "region")).toBe(true);
  });
  it("respects disabled categories", () => {
    const a = deriveAlerts({ quakes: [quake(6.5, 1)], places: [] }, { ...DEFAULT_PREFS.alerts, quakeMinMag: 7 }, NOW);
    expect(a).toHaveLength(0);
  });
});

describe("timeline", () => {
  it("filters by age and category and sorts newest first", () => {
    const items = [quake(5, 0.5), quake(5, 3), quake(5, 30)].map(eventToItem);
    const t1 = buildTimeline(items, { categories: [], regions: [], maxAgeH: 6 }, NOW);
    expect(t1).toHaveLength(2);
    expect(t1[0].updatedAt > t1[1].updatedAt).toBe(true);
    expect(buildTimeline(items, { categories: ["news"], regions: [], maxAgeH: 168 }, NOW)).toHaveLength(0);
  });
  it("assigns rough regions from coordinates", () => {
    expect(regionFromPoint(52.5, 13.4)).toBe("europe");
    expect(regionFromPoint(40.7, -74)).toBe("americas");
    expect(regionFromPoint(35.7, 139.7)).toBe("asia");
    expect(regionFromPoint(-33.9, 151.2)).toBe("oceania");
    expect(regionFromPoint(-1.3, 36.8)).toBe("africa");
  });
});

describe("misc", () => {
  it("computes distances", () => {
    expect(Math.round(distanceKm({ lat: 52.52, lon: 13.41 }, { lat: 48.14, lon: 11.58 }))).toBe(504);
  });
  it("knows exchange sessions", () => {
    const nyse = EXCHANGES.find((e) => e.id === "nyse")!;
    expect(isOpen(nyse, new Date("2026-10-28T15:00:00Z"))).toBe(true); // 11:00 New York, Wednesday
    expect(isOpen(nyse, new Date("2026-10-31T15:00:00Z"))).toBe(false); // Saturday
    expect(isOpen(nyse, new Date("2026-10-28T22:00:00Z"))).toBe(false); // after close
  });
});
