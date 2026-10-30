"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { nightPolygon } from "@/lib/astro";
import { useDark } from "@/lib/use-dark";
import type { IssTrackPoint } from "@/server/providers/space";

if (typeof window !== "undefined") maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);

/** Split the track where it crosses the antimeridian so lines don't wrap the globe. */
function trackLines(track: IssTrackPoint[]): GeoJSON.FeatureCollection {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  track.forEach((p, i) => {
    if (i && Math.abs(p.lon - track[i - 1].lon) > 180) {
      segs.push(cur);
      cur = [];
    }
    cur.push([p.lon, p.lat]);
  });
  segs.push(cur);
  return { type: "FeatureCollection", features: segs.filter((s) => s.length > 1).map((c) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) };
}

/** Live ISS position on a globe that follows the station, with the next orbit drawn ahead. */
export default function IssTracker({ lat, lon, track }: { lat: number; lon: number; track: IssTrackPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  const dark = useDark();
  const latest = useRef({ lat, lon, track });
  useEffect(() => {
    latest.current = { lat, lon, track };
  });

  useEffect(() => {
    if (!el.current) return;
    const style = {
      version: 8,
      projection: { type: "globe" },
      sources: { countries: { type: "geojson", data: "/basemap/countries-110m.geojson" } },
      layers: [
        { id: "ocean", type: "background", paint: { "background-color": dark ? "#071229" : "#cfe0f5" } },
        { id: "land", type: "fill", source: "countries", paint: { "fill-color": dark ? "#122041" : "#f8fbff" } },
        { id: "borders", type: "line", source: "countries", paint: { "line-color": dark ? "#2f6bd6" : "#9db7da", "line-width": 0.6 } },
      ],
    } as StyleSpecification;
    const m = new maplibregl.Map({ container: el.current, style, center: [latest.current.lon, latest.current.lat], zoom: 1.1, interactive: false, attributionControl: false });
    map.current = m;
    const dot = document.createElement("div");
    dot.className = "ping grid h-5 w-5 place-items-center rounded-full border-2 border-black bg-yellow text-yellow";
    marker.current = new maplibregl.Marker({ element: dot }).setLngLat([latest.current.lon, latest.current.lat]).addTo(m);
    m.on("load", () => {
      m.addSource("night", { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [nightPolygon(Date.now())] } }] } });
      m.addLayer({ id: "night", type: "fill", source: "night", paint: { "fill-color": "#000814", "fill-opacity": dark ? 0.45 : 0.2 } });
      m.addSource("track", { type: "geojson", data: trackLines(latest.current.track) });
      m.addLayer({ id: "track-glow", type: "line", source: "track", paint: { "line-color": "#ffd60a", "line-width": 6, "line-opacity": 0.18, "line-blur": 3 } });
      m.addLayer({ id: "track", type: "line", source: "track", paint: { "line-color": "#ffd60a", "line-width": 1.6, "line-dasharray": [2, 1.5] } });
      ready.current = true;
    });
    return () => {
      ready.current = false;
      marker.current?.remove();
      m.remove();
      map.current = null;
    };
  }, [dark]);

  useEffect(() => {
    marker.current?.setLngLat([lon, lat]);
    map.current?.easeTo({ center: [lon, lat], duration: 1500 });
  }, [lat, lon]);

  useEffect(() => {
    if (ready.current) (map.current?.getSource("track") as GeoJSONSource | undefined)?.setData(trackLines(track));
  }, [track]);

  return <div ref={el} className="h-[240px] w-full" aria-hidden />;
}
