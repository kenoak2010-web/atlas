import { describe, expect, it } from "vitest";
import { moonPhase, nightPolygon, subsolarPoint, sunTimes } from "@/lib/astro";

describe("astro", () => {
  it("puts the sun near the equator at the March equinox, over Greenwich at ~12:07 UTC", () => {
    const p = subsolarPoint(Date.UTC(2026, 2, 20, 12, 7));
    expect(Math.abs(p.lat)).toBeLessThan(0.6);
    expect(Math.abs(p.lon)).toBeLessThan(1.5);
  });

  it("puts the sun at ~23.4°N in June", () => {
    expect(subsolarPoint(Date.UTC(2026, 5, 21, 12)).lat).toBeCloseTo(23.44, 0);
  });

  it("computes Berlin sunrise/sunset on 2026-06-21 within a few minutes", () => {
    const t = sunTimes(52.52, 13.405, Date.UTC(2026, 5, 21, 12));
    // timeanddate: sunrise 04:43, sunset 21:33 CEST → 02:43 / 19:33 UTC
    expect(Math.abs(Date.parse(t.sunrise!) - Date.UTC(2026, 5, 21, 2, 43))).toBeLessThan(4 * 60_000);
    expect(Math.abs(Date.parse(t.sunset!) - Date.UTC(2026, 5, 21, 19, 33))).toBeLessThan(4 * 60_000);
  });

  it("reports polar day at the North Pole in June", () => {
    expect(sunTimes(89, 0, Date.UTC(2026, 5, 21)).polar).toBe("day");
  });

  it("finds a known full moon (2026-01-03 10:03 UTC)", () => {
    const m = moonPhase(Date.UTC(2026, 0, 3, 10, 3));
    expect(m.phase).toBe("full");
    expect(m.illumination).toBeGreaterThan(0.98);
  });

  it("closes the night polygon over the winter pole", () => {
    const ring = nightPolygon(Date.UTC(2026, 11, 21, 12));
    expect(ring.at(-2)?.[1]).toBe(90);
    expect(ring[0]).toEqual(ring.at(-1));
  });
});
