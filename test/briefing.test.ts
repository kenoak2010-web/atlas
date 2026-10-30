import { describe, expect, it } from "vitest";
import { buildBriefing } from "@/lib/briefing";
import { countryAt, parseShapes } from "@/lib/country-shapes";
import type { AtlasEvent } from "@/lib/types";
import { readFileSync } from "node:fs";

const quake = (mag: number, loc: string): AtlasEvent => ({ id: loc, category: "earthquake", title: `M ${mag} – ${loc}`, locationName: loc, source: { name: "USGS" }, time: "2026-10-30T00:00:00Z", severity: 2, meta: { magnitude: mag } });

describe("briefing", () => {
  it("states the strongest quake and market moves from the data", () => {
    const lines = buildBriefing(
      { quakes: [quake(4.9, "A"), quake(6.4, "Off the coast of B")], gdacs: [], news: [], dwd: [], kp: 3, crypto: [{ id: "bitcoin", label: "Bitcoin", changePct: -6.24 }], indices: [{ label: "S&P 500", changePct: 0.4 }] },
      "de",
    );
    const text = lines.map((l) => l.text).join("\n");
    expect(text).toContain("2 Erdbeben ab M4.5");
    expect(text).toContain("M6.4: Off the coast of B");
    expect(text).toContain("keine Unwetterwarnungen");
    expect(text).toContain("Bitcoin -6,2 %");
    expect(text).not.toContain("Geomagnetischer");
  });

  it("skips sections whose data is unavailable", () => {
    expect(buildBriefing({ quakes: null, gdacs: null, news: null, dwd: null, kp: null, crypto: null, indices: null }, "en")).toEqual([]);
  });

  it("reports storms only from Kp 5", () => {
    const l = buildBriefing({ quakes: null, gdacs: null, news: null, dwd: null, kp: 7.3, crypto: null, indices: null }, "en");
    expect(l[0].text).toContain("G3");
  });
});

describe("country lookup", () => {
  const shapes = parseShapes(JSON.parse(readFileSync("public/basemap/countries-110m.geojson", "utf8")));
  it("finds countries for points on land", () => {
    expect(countryAt(52.52, 13.4, shapes)).toBe("DE");
    expect(countryAt(35.68, 139.69, shapes)).toBe("JP");
    expect(countryAt(-33.87, 151.0, shapes)).toBe("AU");
    expect(countryAt(64.7, 177.5, shapes)).toBe("RU");
    expect(countryAt(67, -175, shapes)).toBe("RU");
  });
  it("returns null at sea", () => {
    expect(countryAt(0, -30, shapes)).toBeNull();
  });
});
