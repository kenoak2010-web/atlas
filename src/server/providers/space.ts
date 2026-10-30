import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";

const Iss = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number(),
  velocity: z.number(),
  visibility: z.string().optional(),
  timestamp: z.number(),
});

export const issProvider = defineProvider({
  id: "iss",
  label: "ISS position (wheretheiss.at)",
  category: "space",
  refreshSeconds: 10,
  freshnessClass: "live",
  attribution: { name: "Where the ISS at?", url: "https://wheretheiss.at/w/developer" },
  rateLimit: "No key; ~1 request/second.",
  note: "Position computed from current NORAD orbital elements.",
  params: z.object({}),
  cacheKey: () => "25544",
  async fetch() {
    const d = Iss.parse(await fetchJson("https://api.wheretheiss.at/v1/satellites/25544"));
    const data = { lat: d.latitude, lon: d.longitude, altitudeKm: d.altitude, velocityKmh: d.velocity, visibility: d.visibility ?? null, time: new Date(d.timestamp * 1000).toISOString() };
    return { data, sourceUpdatedAt: data.time };
  },
});

/** SWPC "issue_datetime" is UTC without zone: "2026-10-28 10:05:00.000" */
export function swpcDate(s: string): string | null {
  const t = Date.parse(`${s.trim().replace(" ", "T")}${/[zZ]$/.test(s) ? "" : "Z"}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export interface SpaceWeather {
  kp: { time: string; kp: number }[];
  alerts: { id: string; time: string; productId: string; headline: string; message: string }[];
}

/** Kp product has been published both as array-of-arrays (with header) and array-of-objects. */
export function parseKp(raw: unknown): { time: string; kp: number }[] {
  const rows = z.array(z.unknown()).parse(raw);
  const out: { time: string; kp: number }[] = [];
  for (const r of rows) {
    let t: unknown, k: unknown;
    if (Array.isArray(r)) [t, k] = r;
    else if (r && typeof r === "object") {
      const o = r as Record<string, unknown>;
      t = o.time_tag;
      k = o.Kp ?? o.kp ?? o.kp_index;
    }
    const time = typeof t === "string" ? swpcDate(t) : null;
    const kp = Number(k);
    if (time && Number.isFinite(kp)) out.push({ time, kp });
  }
  return out;
}

export function parseSwpcAlerts(raw: unknown): SpaceWeather["alerts"] {
  const rows = z.array(z.object({ product_id: z.string(), issue_datetime: z.string(), message: z.string() })).parse(raw);
  return rows
    .map((r) => {
      const time = swpcDate(r.issue_datetime);
      const lines = r.message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const headline = lines.find((l) => /^(ALERT|WARNING|WATCH|SUMMARY|EXTENDED WARNING|CANCEL)/i.test(l)) ?? lines[2] ?? r.product_id;
      return time ? { id: `${r.product_id}:${time}`, time, productId: r.product_id, headline, message: lines.slice(0, 14).join("\n") } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 25);
}

export const spaceWeatherProvider = defineProvider({
  id: "space-weather",
  label: "NOAA SWPC – space weather",
  category: "space",
  refreshSeconds: 600,
  freshnessClass: "periodic",
  attribution: { name: "NOAA Space Weather Prediction Center", url: "https://www.swpc.noaa.gov", license: "Public domain (U.S. Government)" },
  rateLimit: "No key.",
  note: "Planetary Kp index (3-hourly) and official SWPC alerts/watches/warnings.",
  params: z.object({}),
  cacheKey: () => "swpc",
  async fetch() {
    const [kpRaw, alertsRaw] = await Promise.all([
      fetchJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
      fetchJson("https://services.swpc.noaa.gov/products/alerts.json"),
    ]);
    const data: SpaceWeather = { kp: parseKp(kpRaw).slice(-24), alerts: parseSwpcAlerts(alertsRaw) };
    return { data, sourceUpdatedAt: data.kp.at(-1)?.time ?? data.alerts[0]?.time ?? null };
  },
});

const Launch = z.object({
  id: z.string(),
  name: z.string(),
  net: z.string(),
  status: z.object({ name: z.string(), abbrev: z.string().optional() }).partial().nullable().optional(),
  launch_service_provider: z.object({ name: z.string() }).partial().nullable().optional(),
  pad: z
    .object({
      name: z.string().optional(),
      latitude: z.union([z.string(), z.number()]).nullable().optional(),
      longitude: z.union([z.string(), z.number()]).nullable().optional(),
      location: z.object({ name: z.string().optional() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  mission: z.object({ description: z.string().nullable().optional(), orbit: z.object({ name: z.string() }).partial().nullable().optional() }).nullable().optional(),
  url: z.string().optional(),
  slug: z.string().optional(),
});

export interface UpcomingLaunch {
  id: string;
  name: string;
  net: string;
  status: string;
  provider: string;
  pad: string;
  location: string;
  lat: number | null;
  lon: number | null;
  mission: string;
  url: string;
}

export const launchesProvider = defineProvider({
  id: "launches",
  label: "Launch Library 2 – upcoming launches",
  category: "space",
  refreshSeconds: 3600,
  freshnessClass: "periodic",
  attribution: { name: "The Space Devs – Launch Library 2", url: "https://thespacedevs.com/llapi", license: "Free tier; attribution requested" },
  rateLimit: "Anonymous: 15 requests/hour – ATLAS caches for 1 hour.",
  note: "Launch dates (NET = no earlier than) change frequently.",
  params: z.object({}),
  cacheKey: () => "upcoming",
  async fetch() {
    const raw = await fetchJson("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&hide_recent_previous=true", { timeoutMs: 20_000 });
    const parsed = z.object({ results: z.array(z.unknown()) }).parse(raw);
    const data: UpcomingLaunch[] = parsed.results.flatMap((r) => {
      const l = Launch.safeParse(r);
      if (!l.success) return [];
      const d = l.data;
      const lat = d.pad?.latitude != null ? Number(d.pad.latitude) : null;
      const lon = d.pad?.longitude != null ? Number(d.pad.longitude) : null;
      return [
        {
          id: d.id,
          name: d.name,
          net: new Date(d.net).toISOString(),
          status: d.status?.name ?? "",
          provider: d.launch_service_provider?.name ?? "",
          pad: d.pad?.name ?? "",
          location: d.pad?.location?.name ?? "",
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          mission: d.mission?.description ?? "",
          url: "https://thespacedevs.com/llapi",
        },
      ];
    });
    return { data, sourceUpdatedAt: null };
  },
});

const IssPosition = z.object({ latitude: z.number(), longitude: z.number(), timestamp: z.number(), visibility: z.string().optional() });

export interface IssTrackPoint {
  lat: number;
  lon: number;
  time: string;
  sunlit: boolean;
}

/** Predicted ISS ground track: one orbit (~95 min) from now in 5-minute steps, computed by wheretheiss.at from current TLEs. */
export const issTrackProvider = defineProvider({
  id: "iss-track",
  label: "ISS ground track (wheretheiss.at)",
  category: "space",
  refreshSeconds: 600,
  freshnessClass: "periodic",
  attribution: { name: "Where the ISS at?", url: "https://wheretheiss.at/w/developer" },
  rateLimit: "No key; ~1 request/second, max 10 timestamps per request.",
  note: "Positions predicted from the current orbital elements (TLE).",
  params: z.object({}),
  cacheKey: () => "orbit",
  async fetch() {
    const start = Math.floor(Date.now() / 300_000) * 300;
    const stamps = Array.from({ length: 20 }, (_, i) => start + i * 300);
    const out: IssTrackPoint[] = [];
    for (let i = 0; i < stamps.length; i += 10) {
      if (i) await new Promise((r) => setTimeout(r, 1100));
      const rows = z.array(IssPosition).parse(await fetchJson(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${stamps.slice(i, i + 10).join(",")}&units=kilometers`));
      for (const r of rows) out.push({ lat: r.latitude, lon: r.longitude, time: new Date(r.timestamp * 1000).toISOString(), sunlit: r.visibility === "daylight" });
    }
    return { data: out, sourceUpdatedAt: out[0]?.time ?? null };
  },
});
