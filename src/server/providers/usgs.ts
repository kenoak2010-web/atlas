import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";
import type { AtlasEvent, Severity } from "@/lib/types";

const Feature = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    updated: z.number().nullable().optional(),
    url: z.string().nullable().optional(),
    alert: z.string().nullable().optional(),
    tsunami: z.number().nullable().optional(),
    sig: z.number().nullable().optional(),
    felt: z.number().nullable().optional(),
    magType: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }).nullable(),
});

export const UsgsFeed = z.object({
  metadata: z.object({ generated: z.number(), title: z.string().optional(), count: z.number().optional() }),
  features: z.array(Feature),
});

export const MIN_MAGS = ["significant", "4.5", "2.5", "1.0", "all"] as const;
export const RANGES = ["hour", "day", "week", "month"] as const;

const Params = z
  .object({
    minMag: z.enum(MIN_MAGS).default("2.5"),
    range: z.enum(RANGES).default("day"),
  })
  // The "all"/"1.0" month feeds are several MB – not sensible for a phone.
  .refine((p) => !(p.range === "month" && (p.minMag === "all" || p.minMag === "1.0")), {
    message: "month range requires minMag >= 2.5",
  });

export function magnitudeSeverity(mag: number | null, alert?: string | null): Severity {
  let s: Severity = mag == null || mag < 4 ? 0 : mag < 5 ? 1 : mag < 6 ? 2 : mag < 7 ? 3 : 4;
  const pager: Record<string, Severity> = { yellow: 2, orange: 3, red: 4 };
  if (alert && pager[alert] && pager[alert] > s) s = pager[alert];
  return s;
}

export function normalizeUsgs(feed: z.infer<typeof UsgsFeed>): AtlasEvent[] {
  return feed.features
    .filter((f) => f.geometry)
    .map((f) => {
      const [lon, lat, depth] = f.geometry!.coordinates;
      const p = f.properties;
      return {
        id: `usgs:${f.id}`,
        category: "earthquake" as const,
        title: p.title ?? `M ${p.mag?.toFixed(1)} – ${p.place ?? "Unknown location"}`,
        locationName: p.place ?? undefined,
        point: { lat, lon, precision: "exact" as const },
        source: { name: "USGS", url: "https://earthquake.usgs.gov" },
        time: new Date(p.time).toISOString(),
        updatedAt: p.updated ? new Date(p.updated).toISOString() : undefined,
        severity: magnitudeSeverity(p.mag, p.alert),
        url: p.url ?? undefined,
        meta: {
          magnitude: p.mag,
          magType: p.magType ?? null,
          depthKm: Math.round(depth * 10) / 10,
          tsunami: p.tsunami === 1,
          alert: p.alert ?? null,
          felt: p.felt ?? null,
          status: p.status ?? null,
          eventType: p.type ?? null,
        },
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
}

export const usgsProvider = defineProvider({
  id: "earthquakes",
  label: "USGS Earthquake Hazards Program",
  category: "earthquake",
  refreshSeconds: 60,
  freshnessClass: "periodic",
  attribution: { name: "U.S. Geological Survey", url: "https://earthquake.usgs.gov/earthquakes/feed/", license: "Public domain (U.S. Government)" },
  rateLimit: "No key; feeds regenerate every minute – poll at most once per minute.",
  note: "Global coverage; small quakes (< M2.5) are mostly reported for the USA only.",
  params: Params,
  cacheKey: (p) => `${p.minMag}_${p.range}`,
  async fetch(p) {
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${p.minMag}_${p.range}.geojson`;
    const feed = UsgsFeed.parse(await fetchJson(url));
    return { data: normalizeUsgs(feed), sourceUpdatedAt: new Date(feed.metadata.generated).toISOString() };
  },
});
