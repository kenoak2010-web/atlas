import type { AtlasEvent } from "./types";
import type { NewsCluster } from "./news/types";
import { regionOf } from "./news/geotag";
import type { Region } from "./news/types";

export interface TimelineItem {
  id: string;
  kind: "event" | "news";
  category: AtlasEvent["category"];
  title: string;
  time: string;
  updatedAt: string;
  severity: number;
  source: string;
  regions: Region[];
  event?: AtlasEvent;
  cluster?: NewsCluster;
}

export function clusterToItem(c: NewsCluster): TimelineItem {
  return {
    id: c.id,
    kind: "news",
    category: "news",
    title: c.title,
    time: c.firstSeen,
    updatedAt: c.lastUpdated,
    severity: c.breaking ? 3 : Math.min(2, Math.round(c.score.severity / 10)),
    source: c.articles.map((a) => a.sourceName).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(", "),
    regions: c.regions,
    cluster: c,
  };
}

/** Rough region from coordinates (for events without a country code). */
export function regionFromPoint(lat: number, lon: number): Region | null {
  if (lon >= -170 && lon <= -30) return "americas";
  if (lat >= 35 && lon > -30 && lon <= 45) return "europe";
  if (lat < 35 && lat > -38 && lon > -20 && lon <= 52) return "africa";
  if (lon > 110 && lat < -10) return "oceania";
  if (lon > 25) return "asia";
  return null;
}

export function eventToItem(e: AtlasEvent): TimelineItem {
  const r = e.countryCode ? regionOf(e.countryCode) : e.point ? regionFromPoint(e.point.lat, e.point.lon) : null;
  return {
    id: e.id,
    kind: "event",
    category: e.category,
    title: e.title,
    time: e.time,
    updatedAt: e.updatedAt ?? e.time,
    severity: e.severity,
    source: e.source.name,
    regions: r ? [r] : [],
    event: e,
  };
}

export interface TimelineFilter {
  categories: string[];
  regions: Region[];
  maxAgeH: number;
}

/** Merge, de-duplicate and filter items into a single chronological list (newest first). */
export function buildTimeline(items: TimelineItem[], f: TimelineFilter, now = Date.now()): TimelineItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      if (now - Date.parse(i.updatedAt) > f.maxAgeH * 3600_000) return false;
      if (f.categories.length && !f.categories.includes(i.category)) return false;
      if (f.regions.length && !i.regions.some((r) => f.regions.includes(r))) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
