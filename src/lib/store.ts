"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Lang = "de" | "en";
export type ThemePref = "system" | "light" | "dark";
export type RefreshMode = "normal" | "saver" | "manual";

export const WIDGETS = ["brief", "map", "quakes", "weather", "alerts", "aviation", "markets", "tv", "timeline"] as const;
export type WidgetId = (typeof WIDGETS)[number];

export const MAP_LAYERS = ["news", "quakes", "disasters", "weather", "alerts", "wildfires", "volcanoes", "humanitarian", "aircraft", "iss"] as const;
export type MapLayerId = (typeof MAP_LAYERS)[number];

export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Radius for regional alerts (km) */
  radiusKm: number;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  source: string;
  time: string;
  savedAt: string;
}

export interface AlertSettings {
  enabled: boolean;
  notify: boolean;
  quakeMinMag: number;
  breakingNews: boolean;
  weather: boolean;
  disasters: boolean;
  marketMovePct: number;
  savedRegions: boolean;
}

export interface Prefs {
  lang: Lang;
  theme: ThemePref;
  refresh: RefreshMode;
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  topics: string[];
  countries: string[];
  mapLayers: MapLayerId[];
  favoriteChannels: string[];
  places: SavedPlace[];
  homePlaceId: string | null;
  bookmarks: Bookmark[];
  savedSearches: string[];
  watchedAirports: string[];
  /** Market symbols pinned to the economy watchlist */
  watchlist: string[];
  alerts: AlertSettings;
}

interface Actions {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  toggleIn: <K extends "topics" | "countries" | "mapLayers" | "favoriteChannels" | "hiddenWidgets" | "savedSearches" | "watchedAirports" | "watchlist">(key: K, value: Prefs[K][number]) => void;
  moveWidget: (id: WidgetId, dir: -1 | 1) => void;
  addPlace: (p: Omit<SavedPlace, "id">) => void;
  removePlace: (id: string) => void;
  toggleBookmark: (b: Omit<Bookmark, "savedAt">) => void;
  setAlerts: (patch: Partial<AlertSettings>) => void;
  reset: () => void;
}

export const DEFAULT_PREFS: Prefs = {
  lang: "de",
  theme: "system",
  refresh: "normal",
  widgetOrder: [...WIDGETS],
  hiddenWidgets: [],
  topics: [],
  countries: [],
  mapLayers: ["news", "quakes", "disasters"],
  favoriteChannels: [],
  places: [],
  homePlaceId: null,
  bookmarks: [],
  savedSearches: [],
  watchedAirports: [],
  watchlist: [],
  alerts: {
    enabled: true,
    notify: false,
    quakeMinMag: 6,
    breakingNews: true,
    weather: true,
    disasters: true,
    marketMovePct: 3,
    savedRegions: true,
  },
};

export const usePrefs = create<Prefs & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (key, value) => set({ [key]: value } as Partial<Prefs>),
      toggleIn: (key, value) =>
        set((s) => {
          const list = s[key] as string[];
          return { [key]: list.includes(value as string) ? list.filter((v) => v !== value) : [...list, value] } as Partial<Prefs>;
        }),
      moveWidget: (id, dir) =>
        set((s) => {
          const order = [...s.widgetOrder];
          const i = order.indexOf(id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= order.length) return {};
          [order[i], order[j]] = [order[j], order[i]];
          return { widgetOrder: order };
        }),
      addPlace: (p) => set((s) => ({ places: [...s.places, { ...p, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }] })),
      removePlace: (id) => set((s) => ({ places: s.places.filter((p) => p.id !== id), homePlaceId: s.homePlaceId === id ? null : s.homePlaceId })),
      toggleBookmark: (b) =>
        set((s) =>
          s.bookmarks.some((x) => x.id === b.id)
            ? { bookmarks: s.bookmarks.filter((x) => x.id !== b.id) }
            : { bookmarks: [{ ...b, savedAt: new Date().toISOString() }, ...s.bookmarks].slice(0, 300) },
        ),
      setAlerts: (patch) => set((s) => ({ alerts: { ...s.alerts, ...patch } })),
      reset: () => set({ ...DEFAULT_PREFS }),
    }),
    {
      name: "atlas-prefs",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // New widgets added in later versions are appended to stored orders.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Prefs>;
        const order = (p.widgetOrder ?? []).filter((w) => (WIDGETS as readonly string[]).includes(w));
        for (const w of WIDGETS) if (!order.includes(w)) order.push(w);
        return { ...current, ...p, widgetOrder: order, alerts: { ...DEFAULT_PREFS.alerts, ...p.alerts } };
      },
    },
  ),
);

/** True once persisted preferences have been loaded from localStorage. */
export function usePrefsHydrated(): boolean {
  return usePrefs.persist?.hasHydrated?.() ?? false;
}
