import { describe, expect, it } from "vitest";
import { EXCHANGES, sessionProgress } from "@/lib/market-hours";

const xetra = EXCHANGES.find((e) => e.id === "xetra")!;

describe("sessionProgress", () => {
  it("reports progress through an open session", () => {
    // Fri 2026-10-30 12:00 UTC = 13:00 CET → (780 − 540) / (1050 − 540)
    expect(sessionProgress(xetra, new Date("2026-10-30T12:00:00Z"))).toBeCloseTo(240 / 510, 5);
  });
  it("is null when closed or at the weekend", () => {
    expect(sessionProgress(xetra, new Date("2026-10-30T20:00:00Z"))).toBeNull();
    expect(sessionProgress(xetra, new Date("2026-10-31T12:00:00Z"))).toBeNull();
  });
});
