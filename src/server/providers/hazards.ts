import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson, fetchText } from "../http";
import { representativePoint } from "./geo";
import type { AtlasEvent, Severity } from "@/lib/types";
import { htmlToText, safeUrl } from "@/lib/text";
import { XMLParser } from "fast-xml-parser";

/* ------------------------------------------------------------------ GDACS */

const GdacsFeature = z.object({
  geometry: z.object({ type: z.string(), coordinates: z.unknown() }).nullable(),
  properties: z
    .object({
      eventtype: z.string(),
      eventid: z.union([z.number(), z.string()]),
      episodeid: z.union([z.number(), z.string()]).optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      alertlevel: z.string().optional(),
      country: z.string().optional(),
      fromdate: z.string().optional(),
      todate: z.string().optional(),
      datemodified: z.string().optional(),
      iso3: z.string().optional(),
      iscurrent: z.union([z.string(), z.boolean()]).optional(),
      severitydata: z.object({ severitytext: z.string().optional() }).partial().optional(),
      url: z.object({ report: z.string().optional() }).partial().optional(),
    })
    .passthrough(),
});

const GDACS_TYPES: Record<string, string> = { EQ: "Earthquake", TC: "Tropical cyclone", FL: "Flood", VO: "Volcano", DR: "Drought", WF: "Wildfire", TS: "Tsunami" };
const ALERT_SEVERITY: Record<string, Severity> = { green: 1, orange: 3, red: 4 };

function gdacsDate(s?: string): string | null {
  if (!s) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function normalizeGdacs(features: z.infer<typeof GdacsFeature>[]): AtlasEvent[] {
  const out = new Map<string, AtlasEvent>();
  for (const f of features) {
    const p = f.properties;
    if (f.geometry?.type !== "Point") continue; // MAP endpoint also returns polygons per event
    const pt = representativePoint(f.geometry as { type: string; coordinates: unknown });
    const time = gdacsDate(p.fromdate);
    if (!pt || !time) continue;
    const id = `gdacs:${p.eventtype}${p.eventid}`;
    const type = GDACS_TYPES[p.eventtype] ?? p.eventtype;
    out.set(id, {
      id,
      category: p.eventtype === "VO" ? "volcano" : p.eventtype === "WF" ? "wildfire" : "disaster",
      title: p.name ? `${type}: ${p.name}` : `${type}${p.country ? ` – ${p.country}` : ""}`,
      description: htmlToText(p.description ?? p.severitydata?.severitytext ?? "", 300) || undefined,
      locationName: p.country,
      point: { ...pt, precision: "area" },
      source: { name: "GDACS", url: "https://www.gdacs.org" },
      time,
      updatedAt: gdacsDate(p.datemodified) ?? undefined,
      severity: ALERT_SEVERITY[(p.alertlevel ?? "").toLowerCase()] ?? 1,
      url: safeUrl(p.url?.report) ?? `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
      meta: { alertLevel: p.alertlevel ?? null, eventType: p.eventtype, severityText: p.severitydata?.severitytext ?? null },
    });
  }
  return [...out.values()].sort((a, b) => b.time.localeCompare(a.time));
}

export const gdacsProvider = defineProvider({
  id: "gdacs",
  label: "GDACS – Global Disaster Alert and Coordination System",
  category: "disaster",
  refreshSeconds: 600,
  freshnessClass: "periodic",
  attribution: { name: "GDACS (UN OCHA & European Commission JRC)", url: "https://www.gdacs.org", license: "Free use with attribution" },
  rateLimit: "No key; ATLAS polls every 10 minutes.",
  note: "Automatic alerts for earthquakes, tropical cyclones, floods, volcanoes, droughts and wildfires. Alert level is model-based impact estimate.",
  params: z.object({}),
  cacheKey: () => "all",
  async fetch() {
    const raw = await fetchJson("https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtypes=EQ,TC,FL,VO,DR,WF", { timeoutMs: 20_000 });
    const parsed = z.object({ features: z.array(z.unknown()) }).parse(raw);
    const features = parsed.features.flatMap((f) => {
      const r = GdacsFeature.safeParse(f);
      return r.success ? [r.data] : [];
    });
    const data = normalizeGdacs(features);
    const newest = data.reduce((m, e) => ((e.updatedAt ?? e.time) > m ? (e.updatedAt ?? e.time) : m), "");
    return { data, sourceUpdatedAt: newest || null };
  },
});

/* ------------------------------------------------------------------ NASA EONET */

const EonetEvent = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  link: z.string().optional(),
  categories: z.array(z.object({ id: z.string(), title: z.string() })),
  sources: z.array(z.object({ id: z.string(), url: z.string() })).default([]),
  geometry: z.array(
    z.object({
      date: z.string(),
      type: z.string(),
      coordinates: z.unknown(),
      magnitudeValue: z.number().nullable().optional(),
      magnitudeUnit: z.string().nullable().optional(),
    }),
  ),
});

const EONET_CATEGORY: Record<string, AtlasEvent["category"]> = {
  wildfires: "wildfire",
  volcanoes: "volcano",
  severeStorms: "disaster",
  floods: "disaster",
  seaLakeIce: "disaster",
  landslides: "disaster",
  drought: "disaster",
  dustHaze: "disaster",
  snow: "disaster",
  tempExtremes: "disaster",
};

export function normalizeEonet(events: z.infer<typeof EonetEvent>[]): AtlasEvent[] {
  const out: AtlasEvent[] = [];
  for (const e of events) {
    const g = e.geometry[e.geometry.length - 1];
    const pt = g ? representativePoint(g) : null;
    if (!g || !pt) continue;
    const cat = e.categories[0];
    out.push({
      id: `eonet:${e.id}`,
      category: EONET_CATEGORY[cat?.id] ?? "disaster",
      title: e.title,
      description: e.description ?? undefined,
      point: { ...pt, precision: g.type === "Point" ? "exact" : "area" },
      source: { name: e.sources[0] ? `NASA EONET / ${e.sources[0].id}` : "NASA EONET", url: "https://eonet.gsfc.nasa.gov" },
      time: new Date(e.geometry[0].date).toISOString(),
      updatedAt: new Date(g.date).toISOString(),
      severity: 1,
      url: safeUrl(e.sources[0]?.url) ?? safeUrl(e.link),
      meta: {
        eonetCategory: cat?.title ?? null,
        magnitude: g.magnitudeValue ?? null,
        magnitudeUnit: g.magnitudeUnit ?? null,
      },
    });
  }
  return out.sort((a, b) => (b.updatedAt ?? b.time).localeCompare(a.updatedAt ?? a.time));
}

export const eonetProvider = defineProvider({
  id: "eonet",
  label: "NASA EONET – natural events",
  category: "disaster",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: { name: "NASA Earth Observatory Natural Event Tracker", url: "https://eonet.gsfc.nasa.gov", license: "NASA open data" },
  rateLimit: "No key required.",
  note: "Curated open natural events (wildfires, volcanoes, storms, ice). Curation can lag hours to days.",
  params: z.object({ days: z.coerce.number().int().min(1).max(60).default(30) }),
  cacheKey: (p) => String(p.days),
  async fetch(p) {
    const raw = await fetchJson(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${p.days}`, { timeoutMs: 20_000 });
    const parsed = z.object({ events: z.array(z.unknown()) }).parse(raw);
    const events = parsed.events.flatMap((e) => {
      const r = EonetEvent.safeParse(e);
      return r.success ? [r.data] : [];
    });
    const data = normalizeEonet(events);
    return { data, sourceUpdatedAt: data[0]?.updatedAt ?? null };
  },
});

/* ------------------------------------------------------------------ NASA FIRMS */

export interface FirePoint {
  lat: number;
  lon: number;
  frp: number | null;
  confidence: string;
  acquiredAt: string;
  satellite: string;
  daynight: string;
}

export function parseFirmsCsv(csv: string, limit = 6000): FirePoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const col = (n: string) => header.indexOf(n);
  const [iLat, iLon, iDate, iTime, iConf, iFrp, iSat, iDn] = ["latitude", "longitude", "acq_date", "acq_time", "confidence", "frp", "satellite", "daynight"].map(col);
  if (iLat < 0 || iLon < 0 || iDate < 0) throw new Error("Unexpected FIRMS CSV format");
  const pts: FirePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const t = (c[iTime] ?? "0000").padStart(4, "0");
    pts.push({
      lat,
      lon,
      frp: iFrp >= 0 && c[iFrp] !== "" ? Number(c[iFrp]) : null,
      confidence: iConf >= 0 ? c[iConf] : "",
      acquiredAt: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00.000Z`,
      satellite: iSat >= 0 ? c[iSat] : "",
      daynight: iDn >= 0 ? c[iDn] : "",
    });
  }
  // Keep the strongest detections when the region is large.
  return pts.sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0)).slice(0, limit);
}

export const firmsProvider = defineProvider({
  id: "firms",
  label: "NASA FIRMS – VIIRS active fire detections",
  category: "wildfire",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: { name: "NASA FIRMS (LANCE)", url: "https://firms.modaps.eosdis.nasa.gov", license: "NASA open data; cite FIRMS" },
  rateLimit: "Free MAP_KEY; 5,000 transactions per 10 minutes.",
  requiresKey: "FIRMS_MAP_KEY",
  note: "Satellite-detected thermal anomalies (last 24 h). A hotspot is not a confirmed wildfire – it can also be industry, gas flares or volcanoes.",
  params: z.object({
    bbox: z
      .string()
      .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
      .default("-180,-90,180,90")
      .transform((s) => s.split(",").map((n, i) => (i < 2 ? Math.floor(Number(n)) : Math.ceil(Number(n)))).join(",")),
  }),
  cacheKey: (p) => p.bbox,
  async fetch(p, ctx) {
    const key = ctx.env.FIRMS_MAP_KEY!;
    const csv = await fetchText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_NOAA20_NRT/${p.bbox}/1`, { timeoutMs: 25_000 });
    if (/invalid map_key|exceeding/i.test(csv.slice(0, 200))) throw new Error(csv.slice(0, 120));
    const data = parseFirmsCsv(csv);
    const newest = data.reduce((m, d) => (d.acquiredAt > m ? d.acquiredAt : m), "");
    return { data, sourceUpdatedAt: newest || null };
  },
});

/* ------------------------------------------------------------------ Smithsonian GVP */

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export function parseGvpRss(text: string): AtlasEvent[] {
  const doc = xml.parse(text);
  const raw = doc?.rss?.channel?.item;
  const items: Record<string, unknown>[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const out: AtlasEvent[] = [];
  for (const it of items) {
    const title = htmlToText(String(it.title ?? ""), 200);
    const point = String(it["georss:point"] ?? "").trim().split(/\s+/).map(Number);
    const pub = Date.parse(String(it.pubDate ?? ""));
    if (!title || point.length !== 2 || point.some((n) => !Number.isFinite(n)) || !Number.isFinite(pub)) continue;
    const name = title.split(" - ")[0];
    out.push({
      id: `gvp:${name}:${pub}`,
      category: "volcano",
      title: name,
      description: htmlToText(String(it.description ?? ""), 400),
      locationName: /\(([^)]+)\)/.exec(name)?.[1],
      point: { lat: point[0], lon: point[1], precision: "exact" },
      source: { name: "Smithsonian GVP / USGS", url: "https://volcano.si.edu" },
      time: new Date(pub).toISOString(),
      severity: /new activity/i.test(title) ? 2 : 1,
      url: safeUrl(it.link),
      meta: { report: title.split(" - ").slice(1).join(" – ") || null },
    });
  }
  return out;
}

export const gvpProvider = defineProvider({
  id: "volcanoes",
  label: "Smithsonian/USGS Weekly Volcanic Activity Report",
  category: "volcano",
  refreshSeconds: 6 * 3600,
  freshnessClass: "delayed",
  attribution: { name: "Smithsonian Institution Global Volcanism Program", url: "https://volcano.si.edu/reports_weekly.cfm", license: "Cite: Global Volcanism Program, Smithsonian Institution" },
  rateLimit: "Weekly RSS; polled every 6 hours.",
  note: "Weekly summary (published Wednesdays) – not real-time eruption alerts.",
  params: z.object({}),
  cacheKey: () => "weekly",
  async fetch() {
    const data = parseGvpRss(await fetchText("https://volcano.si.edu/news/WeeklyVolcanoRSS.xml", { timeoutMs: 20_000 }));
    return { data, sourceUpdatedAt: data[0]?.time ?? null };
  },
});

/* ------------------------------------------------------------------ Weather alerts */

const NwsFeature = z.object({
  id: z.string(),
  geometry: z.object({ type: z.string(), coordinates: z.unknown() }).nullable(),
  properties: z.object({
    id: z.string(),
    event: z.string(),
    headline: z.string().nullable().optional(),
    severity: z.string(),
    certainty: z.string().optional(),
    urgency: z.string().optional(),
    areaDesc: z.string(),
    sent: z.string(),
    effective: z.string().optional(),
    expires: z.string().nullable().optional(),
    ends: z.string().nullable().optional(),
    senderName: z.string().optional(),
    description: z.string().nullable().optional(),
    instruction: z.string().nullable().optional(),
  }),
});

const SEV: Record<string, Severity> = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };

export function normalizeNws(features: z.infer<typeof NwsFeature>[]): AtlasEvent[] {
  return features.map((f) => {
    const p = f.properties;
    const pt = representativePoint(f.geometry);
    return {
      id: `nws:${p.id}`,
      category: "weather-alert" as const,
      title: p.event,
      description: htmlToText(p.headline ?? p.description ?? "", 300),
      locationName: `${p.areaDesc.split(";").slice(0, 3).join(", ")} (USA)`,
      countryCode: "US",
      point: pt ? { ...pt, precision: "area" as const } : undefined,
      source: { name: p.senderName ?? "NOAA National Weather Service", url: "https://www.weather.gov" },
      time: new Date(p.sent).toISOString(),
      severity: SEV[p.severity] ?? 1,
      url: `https://api.weather.gov/alerts/${encodeURIComponent(p.id)}`,
      meta: { expires: p.ends ?? p.expires ?? null, certainty: p.certainty ?? null, urgency: p.urgency ?? null },
    };
  });
}

export const nwsProvider = defineProvider({
  id: "alerts-us",
  label: "NOAA/NWS active alerts (USA)",
  category: "weather-alert",
  refreshSeconds: 300,
  freshnessClass: "periodic",
  attribution: { name: "NOAA National Weather Service", url: "https://www.weather.gov/documentation/services-web-api", license: "Public domain (U.S. Government)" },
  rateLimit: "No key; User-Agent required; generous limits.",
  note: "Official warnings for the United States only (severity Severe/Extreme).",
  params: z.object({}),
  cacheKey: () => "severe",
  async fetch() {
    const raw = await fetchJson("https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe", {
      headers: { Accept: "application/geo+json" },
      timeoutMs: 20_000,
    });
    const parsed = z.object({ features: z.array(z.unknown()), updated: z.string().optional() }).parse(raw);
    const data = normalizeNws(parsed.features.flatMap((f) => {
      const r = NwsFeature.safeParse(f);
      return r.success ? [r.data] : [];
    })).sort((a, b) => b.severity - a.severity || b.time.localeCompare(a.time));
    return { data, sourceUpdatedAt: parsed.updated ?? data[0]?.time ?? null };
  },
});

const DwdWarning = z.object({
  regionName: z.string(),
  start: z.number(),
  end: z.number().nullable().optional(),
  level: z.number(),
  event: z.string(),
  headline: z.string(),
  description: z.string().optional(),
  instruction: z.string().optional(),
  stateShort: z.string().optional(),
});

const DWD_SEV: Record<number, Severity> = { 1: 1, 2: 2, 3: 3, 4: 4 };

export function parseDwd(jsonp: string): { time: number; events: AtlasEvent[] } {
  const start = jsonp.indexOf("(");
  const end = jsonp.lastIndexOf(")");
  if (start < 0 || end < start) throw new Error("Unexpected DWD format");
  const obj = z
    .object({ time: z.number(), warnings: z.record(z.string(), z.array(z.unknown())) })
    .parse(JSON.parse(jsonp.slice(start + 1, end)));
  const seen = new Map<string, AtlasEvent>();
  for (const [regionId, list] of Object.entries(obj.warnings)) {
    for (const w of list) {
      const r = DwdWarning.safeParse(w);
      if (!r.success || r.data.level < 2) continue;
      const d = r.data;
      // Group identical warnings (same event/level/start) across districts.
      const key = `${d.event}|${d.level}|${d.start}|${d.stateShort ?? ""}`;
      const existing = seen.get(key);
      if (existing) {
        const n = Number(existing.meta?.districts ?? 1) + 1;
        existing.meta = { ...existing.meta, districts: n };
        continue;
      }
      seen.set(key, {
        id: `dwd:${regionId}:${d.start}:${d.level}`,
        category: "weather-alert",
        title: d.headline,
        description: htmlToText(d.description ?? "", 300),
        locationName: `${d.regionName}${d.stateShort ? ` (${d.stateShort})` : ""}`,
        countryCode: "DE",
        source: { name: "Deutscher Wetterdienst", url: "https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html" },
        time: new Date(d.start).toISOString(),
        severity: DWD_SEV[Math.min(d.level, 4)] ?? 1,
        url: "https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html",
        meta: { level: d.level, ends: d.end ? new Date(d.end).toISOString() : null, districts: 1 },
      });
    }
  }
  return { time: obj.time, events: [...seen.values()].sort((a, b) => b.severity - a.severity) };
}

export const dwdProvider = defineProvider({
  id: "alerts-de",
  label: "DWD Unwetterwarnungen (Deutschland)",
  category: "weather-alert",
  refreshSeconds: 300,
  freshnessClass: "periodic",
  attribution: { name: "Deutscher Wetterdienst", url: "https://www.dwd.de", license: "GeoNutzV – Quelle: Deutscher Wetterdienst" },
  rateLimit: "No key; file updated every few minutes.",
  note: "Official warnings for German districts, level ≥ 2 (markante Wetterwarnung). No coordinates – shown in lists only.",
  params: z.object({}),
  cacheKey: () => "warnings",
  async fetch() {
    const { time, events } = parseDwd(await fetchText("https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json", { timeoutMs: 20_000 }));
    return { data: events, sourceUpdatedAt: new Date(time).toISOString() };
  },
});
