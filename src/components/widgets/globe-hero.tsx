"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Maximize2 } from "lucide-react";
import { useProvider } from "@/lib/api";
import { nightPolygon } from "@/lib/astro";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import { useDark } from "@/lib/use-dark";
import { useNews } from "../news";
import { cn, useNow } from "../ui";

if (typeof window !== "undefined") maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);

type FC = GeoJSON.FeatureCollection;
const EMPTY: FC = { type: "FeatureCollection", features: [] };

function points(items: { lat: number; lon: number; props: Record<string, unknown> }[]): FC {
  return { type: "FeatureCollection", features: items.map((p) => ({ type: "Feature", properties: p.props, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) };
}

function globeStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: dark
      ? { "sky-color": "#04060c", "horizon-color": "#1b3a7a", "fog-color": "#04060c", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] }
      : { "sky-color": "#eef1f7", "horizon-color": "#9cc3ff", "fog-color": "#eef1f7", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
    sources: {
      countries: { type: "geojson", data: "/basemap/countries-110m.geojson", attribution: "Natural Earth" },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": dark ? "#071229" : "#cfe0f5" } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": dark ? "#122041" : "#f8fbff" } },
      { id: "borders", type: "line", source: "countries", paint: { "line-color": dark ? "#2f6bd6" : "#9db7da", "line-width": 0.6, "line-opacity": dark ? 0.7 : 0.9 } },
    ],
  } as StyleSpecification;
}

/**
 * Animated 3D globe at the top of the overview: day/night shading computed from
 * the sun's position, plus live earthquakes, GDACS alerts, breaking-news
 * countries and the ISS. Tap opens the full map.
 */
export function GlobeHero() {
  const { t, lang } = useT();
  const dark = useDark();
  const router = useRouter();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef<Record<string, FC>>({});
  const now = useNow(60_000);

  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const iss = useProvider<{ lat: number; lon: number }>("iss");
  const news = useNews();

  const layers = useMemo(() => {
    const q = (quakes.data?.data ?? []).filter((e) => e.point).map((e) => ({ lat: e.point!.lat, lon: e.point!.lon, props: { mag: Number(e.meta?.mag ?? 4.5) } }));
    const d = (gdacs.data?.data ?? []).filter((e) => e.point && e.severity >= 2).map((e) => ({ lat: e.point!.lat, lon: e.point!.lon, props: { sev: e.severity } }));
    const n = news.clusters.filter((c) => c.point && (c.breaking || c.sourceCount >= 3)).slice(0, 30).map((c) => ({ lat: c.point!.lat, lon: c.point!.lon, props: { breaking: c.breaking } }));
    const i = iss.data?.data ? [{ lat: iss.data.data.lat, lon: iss.data.data.lon, props: {} }] : [];
    return { quakes: points(q), disasters: points(d), news: points(n), iss: points(i), counts: { q: q.length, d: d.length, n: n.length } };
  }, [quakes.data, gdacs.data, news.clusters, iss.data]);

  const night = useMemo<FC>(() => ({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [nightPolygon(now)] } }] }), [now]);

  // Create the map once per theme.
  useEffect(() => {
    if (!el.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({
      container: el.current,
      style: globeStyle(dark),
      center: [10, 22],
      zoom: 0.9,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    let raf = 0;
    let last = 0;
    let t0 = 0;
    map.on("load", () => {
      map.addSource("night", { type: "geojson", data: EMPTY });
      map.addLayer({ id: "night", type: "fill", source: "night", paint: { "fill-color": "#000814", "fill-opacity": dark ? 0.5 : 0.22 } });
      for (const id of ["disasters", "news", "quakes", "iss"]) map.addSource(id, { type: "geojson", data: EMPTY });
      map.addLayer({ id: "quakes-pulse", type: "circle", source: "quakes", paint: { "circle-color": "#ff9f0a", "circle-radius": 6, "circle-opacity": 0.3, "circle-blur": 0.4 } });
      map.addLayer({ id: "quakes", type: "circle", source: "quakes", paint: { "circle-color": ["interpolate", ["linear"], ["get", "mag"], 4.5, "#ffb340", 6.5, "#ff453a"], "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 4.5, 2.5, 7, 6], "circle-stroke-width": 0.8, "circle-stroke-color": "#fff" } });
      map.addLayer({ id: "disasters", type: "circle", source: "disasters", paint: { "circle-color": ["match", ["get", "sev"], 4, "#ff453a", 3, "#ff9f0a", "#c77dff"], "circle-radius": 3.5, "circle-stroke-width": 0.8, "circle-stroke-color": "#fff" } });
      map.addLayer({ id: "news-glow", type: "circle", source: "news", paint: { "circle-color": ["case", ["get", "breaking"], "#ff4d5e", "#3d9bff"], "circle-radius": 9, "circle-opacity": 0.25, "circle-blur": 0.8 } });
      map.addLayer({ id: "news", type: "circle", source: "news", paint: { "circle-color": ["case", ["get", "breaking"], "#ff4d5e", "#3d9bff"], "circle-radius": 3, "circle-stroke-width": 0.8, "circle-stroke-color": "#fff" } });
      map.addLayer({ id: "iss", type: "circle", source: "iss", paint: { "circle-color": "#ffd60a", "circle-radius": 4, "circle-stroke-width": 1.5, "circle-stroke-color": "#000" } });
      ready.current = true;
      for (const [id, data] of Object.entries(latest.current)) (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

      const frame = (ts: number) => {
        raf = requestAnimationFrame(frame);
        if (document.hidden || ts - last < 33) return;
        if (!t0) t0 = ts;
        last = ts;
        if (!reduce) {
          const c = map.getCenter();
          map.setCenter([c.lng - 0.06, c.lat]);
          const phase = ((ts - t0) % 1800) / 1800;
          map.setPaintProperty("quakes-pulse", "circle-radius", 4 + phase * 14);
          map.setPaintProperty("quakes-pulse", "circle-opacity", 0.45 * (1 - phase));
        }
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(raf);
      ready.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, [dark]);

  // Push data whenever it changes (and once the style is ready).
  useEffect(() => {
    latest.current = { night, quakes: layers.quakes, disasters: layers.disasters, news: layers.news, iss: layers.iss };
    const map = mapRef.current;
    if (!map || !ready.current) return;
    for (const [id, data] of Object.entries(latest.current)) (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  }, [layers, night, dark]);

  const legend = [
    { color: "bg-orange", label: lang === "de" ? "Erdbeben" : "Quakes", n: layers.counts.q },
    { color: "bg-purple", label: "GDACS", n: layers.counts.d },
    { color: "bg-accent", label: lang === "de" ? "Top-News" : "Top news", n: layers.counts.n },
    { color: "bg-yellow", label: "ISS", n: null },
  ];

  return (
    <section className="card relative overflow-hidden" aria-label={t("widget.map")}>
      <div
        ref={el}
        className="h-[300px] w-full cursor-pointer"
        role="link"
        tabIndex={0}
        aria-label={t("widget.map")}
        onClick={() => router.push("/map")}
        onKeyDown={(e) => e.key === "Enter" && router.push("/map")}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-text-2 uppercase">
            <span className="ping h-1.5 w-1.5 rounded-full bg-green text-green" aria-hidden /> Live · {lang === "de" ? "Globus" : "Globe"}
          </div>
          <div className="mt-0.5 text-[12px] text-text-3">{lang === "de" ? "Tag/Nacht berechnet aus dem Sonnenstand" : "Day/night computed from the sun's position"}</div>
        </div>
        <Link href="/map" aria-label={t("widget.map")} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-accent backdrop-blur">
          <Maximize2 size={16} />
        </Link>
      </div>
      <ul className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-[var(--bg)]/80 to-transparent p-3 pt-8">
        {legend.map((l) => (
          <li key={l.label} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            <span className={cn("h-2 w-2 rounded-full", l.color)} aria-hidden />
            {l.label}
            {l.n != null && <span className="font-bold tabular">{l.n}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
