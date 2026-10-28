"use client";

import { useMemo } from "react";
import { useProvider, type ClientEnvelope } from "@/lib/api";
import type { AtlasEvent } from "@/lib/types";
import type { NewsPayload } from "@/lib/news/types";
import type { MapLayerId } from "@/lib/store";
import type { CityWeather } from "@/server/providers/openmeteo";
import type { Aircraft } from "@/server/providers/aviation";
import type { FirePoint } from "@/server/providers/hazards";
import type { LayerData, MapFeature } from "./atlas-map";

export interface MapFilters {
  minMag: "significant" | "4.5" | "2.5" | "1.0" | "all";
  range: "hour" | "day" | "week" | "month";
  /** hours; filters time-stamped events other than quakes */
  maxAgeH: number;
  bbox: [number, number, number, number] | null;
  zoom: number;
}

export const AIRCRAFT_MIN_ZOOM = 5;

const eventFeature = (e: AtlasEvent, extra: Record<string, string | number | boolean | null> = {}): MapFeature | null =>
  e.point ? { id: e.id, lat: e.point.lat, lon: e.point.lon, props: { sev: e.severity, ...extra }, select: { type: "event", event: e } } : null;

const notNull = <T,>(x: T | null): x is T => x !== null;

export function useMapData(visible: MapLayerId[], f: MapFilters) {
  const on = (l: MapLayerId) => visible.includes(l);
  const now = Date.now();
  const fresh = (iso: string) => now - Date.parse(iso) <= f.maxAgeH * 3600_000;

  const news = useProvider<NewsPayload>("news", undefined, { enabled: on("news") });
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: f.minMag, range: f.range }, { enabled: on("quakes") });
  const gdacs = useProvider<AtlasEvent[]>("gdacs", undefined, { enabled: on("disasters") || on("wildfires") || on("volcanoes") });
  const eonet = useProvider<AtlasEvent[]>("eonet", undefined, { enabled: on("wildfires") || on("volcanoes") || on("disasters") });
  const firms = useProvider<FirePoint[]>("firms", { bbox: "-180,-90,180,90" }, { enabled: on("wildfires") });
  const gvp = useProvider<AtlasEvent[]>("volcanoes", undefined, { enabled: on("volcanoes") });
  const weather = useProvider<CityWeather[]>("world-weather", undefined, { enabled: on("weather") });
  const alerts = useProvider<AtlasEvent[]>("alerts-us", undefined, { enabled: on("alerts") });
  const relief = useProvider<AtlasEvent[]>("humanitarian", undefined, { enabled: on("humanitarian") });
  const iss = useProvider<{ lat: number; lon: number; altitudeKm: number; velocityKmh: number; time: string }>("iss", undefined, { enabled: on("iss") });
  const aircraftEnabled = on("aircraft") && f.zoom >= AIRCRAFT_MIN_ZOOM && f.bbox !== null;
  const bboxStr = f.bbox ? f.bbox.map((n) => n.toFixed(1)).join(",") : "";
  const aircraft = useProvider<Aircraft[]>("aircraft", { bbox: bboxStr }, { enabled: aircraftEnabled });

  const data: LayerData = useMemo(() => {
    const d: LayerData = {};
    d.news = (news.data?.data?.clusters ?? [])
      .filter((c) => c.point && fresh(c.lastUpdated))
      .map((c) => ({ id: c.id, lat: c.point!.lat, lon: c.point!.lon, props: { breaking: c.breaking, sources: c.sourceCount }, select: { type: "news" as const, cluster: c } }));
    d.quakes = (quakes.data?.data ?? []).map((e) => eventFeature(e, { mag: Number(e.meta?.magnitude ?? 0), ageH: (now - Date.parse(e.time)) / 3600_000 })).filter(notNull);
    const g = gdacs.data?.data ?? [];
    const eo = eonet.data?.data ?? [];
    d.disasters = [...g.filter((e) => e.category === "disaster" && e.meta?.eventType !== "EQ"), ...eo.filter((e) => e.category === "disaster")]
      .map((e) => eventFeature(e, { level: String(e.meta?.alertLevel ?? "") }))
      .filter(notNull);
    d.wildfires = [
      ...[...g, ...eo].filter((e) => e.category === "wildfire").map((e) => eventFeature(e, { kind: "event" })).filter(notNull),
      ...(firms.data?.data ?? []).map((p, i) => ({
        id: `firms:${i}`,
        lat: p.lat,
        lon: p.lon,
        props: { kind: "hotspot" },
        select: {
          type: "event" as const,
          event: {
            id: `firms:${p.lat},${p.lon},${p.acquiredAt}`,
            category: "wildfire" as const,
            title: "Thermische Anomalie (Satellit) / Thermal anomaly",
            description: "VIIRS hotspot – not a confirmed wildfire.",
            point: { lat: p.lat, lon: p.lon, precision: "exact" as const },
            source: { name: "NASA FIRMS", url: "https://firms.modaps.eosdis.nasa.gov" },
            time: p.acquiredAt,
            severity: 1 as const,
            url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${p.lon},${p.lat},10z`,
            meta: { frp: p.frp, confidence: p.confidence, satellite: p.satellite },
          },
        },
      })),
    ];
    d.volcanoes = [...(gvp.data?.data ?? []), ...[...g, ...eo].filter((e) => e.category === "volcano")].map((e) => eventFeature(e)).filter(notNull);
    d.weather = (weather.data?.data ?? []).map((c) => ({
      id: `wx:${c.name}`,
      lat: c.lat,
      lon: c.lon,
      props: { temp: c.temperature, code: c.weatherCode },
      select: {
        type: "event" as const,
        event: {
          id: `wx:${c.name}`,
          category: "weather-alert" as const,
          title: `${c.name}: ${c.temperature != null ? Math.round(c.temperature) : "–"} °C`,
          description: `Wind ${c.windSpeed ?? "–"} km/h · ${c.precipitation ?? 0} mm`,
          locationName: c.name,
          point: { lat: c.lat, lon: c.lon, precision: "exact" as const },
          source: { name: "Open-Meteo", url: "https://open-meteo.com" },
          time: c.time,
          severity: 0 as const,
          meta: { weatherCode: c.weatherCode },
        },
      },
    }));
    d.alerts = (alerts.data?.data ?? []).map((e) => eventFeature(e)).filter(notNull);
    d.humanitarian = (relief.data?.data ?? []).map((e) => eventFeature(e)).filter(notNull);
    d.aircraft = aircraftEnabled
      ? (aircraft.data?.data ?? []).map((a) => ({ id: `ac:${a.icao24}`, lat: a.lat, lon: a.lon, props: { heading: a.heading ?? 0 }, select: { type: "aircraft" as const, aircraft: a, fetchedAt: aircraft.data?.fetchedAt ?? null } }))
      : [];
    const i = iss.data?.data;
    d.iss = i
      ? [
          {
            id: "iss",
            lat: i.lat,
            lon: i.lon,
            select: {
              type: "event" as const,
              event: {
                id: "iss",
                category: "space" as const,
                title: "ISS",
                description: `${Math.round(i.altitudeKm)} km · ${Math.round(i.velocityKmh).toLocaleString()} km/h`,
                point: { lat: i.lat, lon: i.lon, precision: "exact" as const },
                source: { name: "wheretheiss.at", url: "https://wheretheiss.at" },
                time: i.time,
                severity: 0 as const,
              },
            },
          },
        ]
      : [];
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news.data, quakes.data, gdacs.data, eonet.data, firms.data, gvp.data, weather.data, alerts.data, relief.data, iss.data, aircraft.data, aircraftEnabled, f.maxAgeH]);

  const envs: Partial<Record<MapLayerId, ClientEnvelope<unknown> | undefined>> = {
    news: news.data,
    quakes: quakes.data,
    disasters: gdacs.data,
    wildfires: firms.data ?? eonet.data,
    volcanoes: gvp.data,
    weather: weather.data,
    alerts: alerts.data,
    humanitarian: relief.data,
    aircraft: aircraft.data,
    iss: iss.data,
  };
  const loading = [news, quakes, gdacs, eonet, gvp, weather, alerts, relief, iss, aircraft].some((q) => q.isFetching);
  return { data, envs, loading, aircraftEnabled };
}
