import { describe, expect, it } from "vitest";
import { UsgsFeed, normalizeUsgs, magnitudeSeverity } from "@/server/providers/usgs";
import { parseDwd, parseFirmsCsv, parseGvpRss, normalizeNws, normalizeEonet, normalizeGdacs } from "@/server/providers/hazards";
import { parseKp, parseSwpcAlerts, swpcDate } from "@/server/providers/space";
import { crossRates, parseFredCsv, fredQuote, FRED_SERIES } from "@/server/providers/markets";
import { normalizeStates, snapBbox } from "@/server/providers/aviation";
import { parseGdeltDate } from "@/server/providers/news";
import { representativePoint } from "@/server/providers/geo";

// Fixtures follow the documented upstream formats; they are test inputs only, never used by the app.

describe("USGS", () => {
  const feed = UsgsFeed.parse({
    metadata: { generated: 1761559200000, title: "t", count: 2 },
    features: [
      { id: "us1", properties: { mag: 6.4, place: "10 km S of X", time: 1761555600000, updated: 1761556000000, url: "https://earthquake.usgs.gov/e/us1", alert: "orange", tsunami: 1, title: "M 6.4 - 10 km S of X" }, geometry: { coordinates: [140.1, 35.2, 10.5] } },
      { id: "us2", properties: { mag: 3.1, place: null, time: 1761552000000 }, geometry: { coordinates: [-120, 36, 5] } },
    ],
  });
  it("normalizes features", () => {
    const ev = normalizeUsgs(feed);
    expect(ev[0]).toMatchObject({ id: "usgs:us1", severity: 3, point: { lat: 35.2, lon: 140.1, precision: "exact" } });
    expect(ev[0].meta).toMatchObject({ depthKm: 10.5, tsunami: true, magnitude: 6.4 });
    expect(ev[1].title).toContain("Unknown location");
  });
  it("maps magnitude to severity", () => {
    expect(magnitudeSeverity(3.9)).toBe(0);
    expect(magnitudeSeverity(5.5)).toBe(2);
    expect(magnitudeSeverity(7.2)).toBe(4);
    expect(magnitudeSeverity(4.2, "red")).toBe(4);
    expect(magnitudeSeverity(null)).toBe(0);
  });
});

describe("DWD", () => {
  const jsonp = `warnWetter.loadWarnings(${JSON.stringify({
    time: 1761559200000,
    warnings: {
      "1": [{ regionName: "Kreis A", start: 1761559200000, end: 1761580800000, level: 3, event: "STURMBÖEN", headline: "Amtliche Unwetterwarnung vor Sturmböen", description: "Es treten Böen auf", stateShort: "BY" }],
      "2": [{ regionName: "Kreis B", start: 1761559200000, end: 1761580800000, level: 3, event: "STURMBÖEN", headline: "Amtliche Unwetterwarnung vor Sturmböen", stateShort: "BY" }],
      "3": [{ regionName: "Kreis C", start: 1761559200000, level: 1, event: "FROST", headline: "Frost" }],
    },
  })});`;
  it("parses JSONP, groups districts, drops level 1", () => {
    const { events } = parseDwd(jsonp);
    expect(events).toHaveLength(1);
    expect(events[0].meta?.districts).toBe(2);
    expect(events[0].severity).toBe(3);
    expect(events[0].point).toBeUndefined();
  });
});

describe("FIRMS", () => {
  it("parses CSV and keeps strongest detections", () => {
    const csv = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n" +
      "10.1,20.2,330,0.4,0.4,2026-10-27,138,N20,VIIRS,n,2.0NRT,290,5.5,D\n" +
      "11.1,21.2,340,0.4,0.4,2026-10-27,1405,N20,VIIRS,h,2.0NRT,290,25,N\n";
    const pts = parseFirmsCsv(csv);
    expect(pts[0]).toMatchObject({ lat: 11.1, frp: 25, acquiredAt: "2026-10-27T14:05:00.000Z" });
    expect(pts[1].acquiredAt).toBe("2026-10-27T01:38:00.000Z");
  });
});

describe("GVP", () => {
  it("reads georss points", () => {
    const rss = `<rss xmlns:georss="http://www.georss.org/georss"><channel><item><title>Etna (Italy) - Report for 21 October-27 October 2026 - New Activity/Unrest</title><link>https://volcano.si.edu/x</link><description>&lt;p&gt;Lava&lt;/p&gt;</description><pubDate>Wed, 28 Oct 2026 12:00:00 EST</pubDate><georss:point>37.748 14.999</georss:point></item></channel></rss>`;
    const [e] = parseGvpRss(rss);
    expect(e).toMatchObject({ title: "Etna (Italy)", locationName: "Italy", severity: 2, point: { lat: 37.748, lon: 14.999 } });
  });
});

describe("NWS / EONET / GDACS", () => {
  it("computes representative point for polygons", () => {
    expect(representativePoint({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] })).toEqual({ lat: 1, lon: 1 });
    expect(representativePoint(null)).toBeNull();
  });
  it("normalizes NWS alerts with and without geometry", () => {
    const ev = normalizeNws([
      { id: "a", geometry: null, properties: { id: "urn:1", event: "Tornado Warning", severity: "Extreme", areaDesc: "A; B", sent: "2026-10-27T10:00:00-05:00" } },
    ]);
    expect(ev[0]).toMatchObject({ severity: 4, countryCode: "US", time: "2026-10-27T15:00:00.000Z" });
    expect(ev[0].point).toBeUndefined();
  });
  it("normalizes EONET events using the latest geometry", () => {
    const [e] = normalizeEonet([
      { id: "EONET_1", title: "Fire", categories: [{ id: "wildfires", title: "Wildfires" }], sources: [{ id: "InciWeb", url: "https://inciweb.example/1" }],
        geometry: [{ date: "2026-10-20T00:00:00Z", type: "Point", coordinates: [-120, 38] }, { date: "2026-10-26T00:00:00Z", type: "Point", coordinates: [-121, 39] }] },
    ]);
    expect(e).toMatchObject({ category: "wildfire", point: { lat: 39, lon: -121 }, updatedAt: "2026-10-26T00:00:00.000Z" });
  });
  it("normalizes GDACS point features only", () => {
    const ev = normalizeGdacs([
      { geometry: { type: "Point", coordinates: [120, 15] }, properties: { eventtype: "TC", eventid: 1, name: "KONG", alertlevel: "Red", fromdate: "2026-10-26T00:00:00", country: "Philippines" } },
      { geometry: { type: "Polygon", coordinates: [] }, properties: { eventtype: "TC", eventid: 1, fromdate: "2026-10-26T00:00:00" } },
    ]);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ severity: 4, title: "Tropical cyclone: KONG", time: "2026-10-26T00:00:00.000Z" });
  });
});

describe("Space", () => {
  it("parses SWPC dates as UTC", () => {
    expect(swpcDate("2026-10-28 10:05:00.000")).toBe("2026-10-28T10:05:00.000Z");
  });
  it("parses both Kp formats", () => {
    expect(parseKp([["time_tag", "Kp", "a_running", "station_count"], ["2026-10-28 00:00:00.000", "3.33", "18", "8"]])).toEqual([{ time: "2026-10-28T00:00:00.000Z", kp: 3.33 }]);
    expect(parseKp([{ time_tag: "2026-10-28T03:00:00", Kp: 5 }])).toEqual([{ time: "2026-10-28T03:00:00.000Z", kp: 5 }]);
  });
  it("extracts alert headlines", () => {
    const [a] = parseSwpcAlerts([{ product_id: "K05W", issue_datetime: "2026-10-28 10:05:00.000", message: "Space Weather Message Code: WARK05\r\nSerial Number: 1\r\nIssue Time: x\r\n\r\nWARNING: Geomagnetic K-index of 5 expected" }]);
    expect(a.headline).toBe("WARNING: Geomagnetic K-index of 5 expected");
  });
});

describe("Markets", () => {
  it("derives cross rates from EUR base", () => {
    const r = crossRates({ USD: 1.1, GBP: 0.85, JPY: 165, CHF: 0.95 });
    expect(r["EUR/USD"]).toBe(1.1);
    expect(r["GBP/USD"]).toBeCloseTo(1.2941, 3);
    expect(r["USD/JPY"]).toBeCloseTo(150, 3);
  });
  it("parses FRED CSV, skipping missing values", () => {
    const rows = parseFredCsv("observation_date,SP500\n2026-10-22,7600\n2026-10-23,.\n2026-10-26,7676\n");
    expect(rows).toEqual([{ t: "2026-10-22", v: 7600 }, { t: "2026-10-26", v: 7676 }]);
    const q = fredQuote(FRED_SERIES[0], rows)!;
    expect(q.price).toBe(7676);
    expect(q.changePct).toBeCloseTo(1, 1);
    expect(q.asOf.startsWith("2026-10-26")).toBe(true);
  });
});

describe("Aviation", () => {
  it("normalizes OpenSky state vectors", () => {
    const [a] = normalizeStates([["3c6444", "DLH9U  ", "Germany", 1761559190, 1761559195, 8.5, 50.03, 1000, false, 120.5, 270, -5, null, 1050, "1000", false, 0]]);
    expect(a).toMatchObject({ icao24: "3c6444", callsign: "DLH9U", lat: 50.03, lon: 8.5, altitude: 1050, onGround: false });
    expect(normalizeStates([["x", null, "", 0, 0, null, null, null, false, null, null, null, null, null, null, false, 0]])).toHaveLength(0);
  });
  it("snaps bbox outward to 2° grid", () => {
    expect(snapBbox([47.3, 5.1, 54.9, 15.2])).toEqual([46, 4, 56, 16]);
  });
});

describe("GDELT", () => {
  it("parses seendate", () => {
    expect(parseGdeltDate("20261028T101500Z")).toBe("2026-10-28T10:15:00.000Z");
    expect(parseGdeltDate("bad")).toBeNull();
  });
});
