"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AtlasEvent } from "./types";
import type { NewsCluster } from "./news/types";
import type { AlertSettings, SavedPlace } from "./store";
import { distanceKm } from "./geo";

export type AlertKind = "quake" | "news" | "weather" | "disaster" | "market" | "region";

export interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  time: string;
  url?: string;
  severity: number;
  source: string;
  read: boolean;
}

interface Inputs {
  quakes?: AtlasEvent[];
  news?: NewsCluster[];
  weather?: AtlasEvent[];
  disasters?: AtlasEvent[];
  markets?: { id: string; label: string; changePct: number | null; asOf: string; changeBasis: string }[];
  places: SavedPlace[];
}

/** Pure: derive alert candidates from current data and the user's thresholds. */
export function deriveAlerts(input: Inputs, s: AlertSettings, now = Date.now()): Omit<AlertItem, "read">[] {
  const out: Omit<AlertItem, "read">[] = [];
  const recent = (iso: string, hours: number) => now - Date.parse(iso) <= hours * 3600_000;

  for (const q of input.quakes ?? []) {
    const mag = Number(q.meta?.magnitude ?? 0);
    if (!recent(q.time, 24)) continue;
    if (mag >= s.quakeMinMag) {
      out.push({ id: `quake:${q.id}`, kind: "quake", title: q.title, body: `M ${mag.toFixed(1)} · ${q.meta?.depthKm ?? "?"} km`, time: q.time, url: q.url, severity: q.severity, source: q.source.name });
    }
    if (s.savedRegions && q.point && mag >= 4) {
      for (const p of input.places) {
        const d = distanceKm(q.point, p);
        if (d <= p.radiusKm) out.push({ id: `region:${p.id}:${q.id}`, kind: "region", title: `${p.name}: ${q.title}`, body: `${Math.round(d)} km`, time: q.time, url: q.url, severity: q.severity, source: q.source.name });
      }
    }
  }

  if (s.breakingNews) {
    for (const c of input.news ?? []) {
      if (!c.breaking) continue;
      out.push({ id: `news:${c.id}`, kind: "news", title: c.title, body: c.articles.map((a) => a.sourceName).filter((v, i, a) => a.indexOf(v) === i).join(", "), time: c.lastUpdated, url: c.url, severity: 2, source: `${c.sourceCount}` });
    }
  }

  if (s.weather) {
    for (const w of input.weather ?? []) {
      if (w.severity < 3) continue;
      out.push({ id: `weather:${w.id}`, kind: "weather", title: w.title, body: w.locationName ?? "", time: w.time, url: w.url, severity: w.severity, source: w.source.name });
    }
  }

  for (const d of input.disasters ?? []) {
    if (s.disasters && d.severity >= 3 && recent(d.updatedAt ?? d.time, 72)) {
      out.push({ id: `disaster:${d.id}:${d.meta?.alertLevel ?? ""}`, kind: "disaster", title: d.title, body: d.locationName ?? "", time: d.updatedAt ?? d.time, url: d.url, severity: d.severity, source: d.source.name });
    }
    if (s.savedRegions && d.point) {
      for (const p of input.places) {
        if (distanceKm(d.point, p) <= p.radiusKm && recent(d.updatedAt ?? d.time, 72)) {
          out.push({ id: `region:${p.id}:${d.id}`, kind: "region", title: `${p.name}: ${d.title}`, body: d.locationName ?? "", time: d.updatedAt ?? d.time, url: d.url, severity: d.severity, source: d.source.name });
        }
      }
    }
  }

  if (s.marketMovePct > 0) {
    for (const m of input.markets ?? []) {
      if (m.changePct == null || Math.abs(m.changePct) < s.marketMovePct) continue;
      const day = m.asOf.slice(0, 10);
      out.push({ id: `market:${m.id}:${day}:${m.changePct > 0 ? "up" : "down"}`, kind: "market", title: `${m.label} ${m.changePct > 0 ? "+" : ""}${m.changePct.toFixed(1)} %`, body: m.changeBasis, time: new Date(now).toISOString(), severity: 1, source: "" });
    }
  }
  return out;
}

interface AlertStore {
  items: AlertItem[];
  ingest: (candidates: Omit<AlertItem, "read">[]) => Omit<AlertItem, "read">[];
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      items: [],
      ingest: (candidates) => {
        const known = new Set(get().items.map((i) => i.id));
        const fresh = candidates.filter((c) => !known.has(c.id));
        if (fresh.length) {
          set((s) => ({ items: [...fresh.map((f) => ({ ...f, read: false })), ...s.items].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 200) }));
        }
        return fresh;
      },
      markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
      markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "atlas-alerts", storage: createJSONStorage(() => localStorage) },
  ),
);
