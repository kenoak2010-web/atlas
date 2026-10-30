import { describe, expect, it } from "vitest";
import { eaqiBand, epicDate } from "@/server/providers/extras";
import { activityIndex } from "@/components/widgets/extra-widgets";
import type { AtlasEvent } from "@/lib/types";

const ev = (severity: number, mag?: number): AtlasEvent => ({
  id: String(Math.random()),
  category: "earthquake",
  title: "x",
  source: { name: "t" },
  time: "2026-10-30T00:00:00Z",
  severity: severity as AtlasEvent["severity"],
  meta: mag != null ? { magnitude: mag } : undefined,
});

describe("extras", () => {
  it("parses EPIC UTC dates", () => {
    expect(epicDate("2026-10-26 00:50:27")).toBe("2026-10-26T00:50:27.000Z");
    expect(epicDate("nope")).toBeNull();
  });

  it("maps EAQI to EEA bands", () => {
    expect([0, 20, 21, 55, 80, 100, 140].map(eaqiBand)).toEqual([0, 0, 1, 2, 3, 4, 5]);
  });

  it("computes the activity index transparently and caps it at 100", () => {
    const idx = activityIndex({ quakes: [ev(2, 7.1), ev(2, 6.2), ev(1, 4.8)], gdacs: [ev(4), ev(3), ev(1)], breaking: 2, severeWeather: 4 }, "de");
    // 12 + 5 + 1 + 12 + 5 + 12 + 2 = 49
    expect(idx.value).toBe(49);
    expect(idx.level).toBe(1);
    expect(activityIndex({ quakes: [], gdacs: Array.from({ length: 20 }, () => ev(4)), breaking: 0, severeWeather: 0 }, "en").value).toBe(100);
  });
});
