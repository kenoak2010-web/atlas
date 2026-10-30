"use client";

import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useDark } from "@/lib/use-dark";

if (typeof window !== "undefined") maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);

/** Small static globe that flies to one location and marks it with a pulsing dot. */
export default function MiniLocator({ lat, lon, color = "#ff9f0a", precision }: { lat: number; lon: number; color?: string; precision?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const dark = useDark();
  useEffect(() => {
    if (!el.current) return;
    const style: StyleSpecification = {
      version: 8,
      projection: { type: "globe" },
      sources: { countries: { type: "geojson", data: "/basemap/countries-110m.geojson" } },
      layers: [
        { id: "ocean", type: "background", paint: { "background-color": dark ? "#071229" : "#cfe0f5" } },
        { id: "land", type: "fill", source: "countries", paint: { "fill-color": dark ? "#122041" : "#f8fbff" } },
        { id: "borders", type: "line", source: "countries", paint: { "line-color": dark ? "#2f6bd6" : "#9db7da", "line-width": 0.7 } },
      ],
    } as StyleSpecification;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = new maplibregl.Map({ container: el.current, style, center: [lon - 40, lat * 0.5], zoom: 0.6, interactive: false, attributionControl: false });
    const dot = document.createElement("div");
    dot.className = "ping h-3.5 w-3.5 rounded-full border-2 border-white";
    dot.style.background = color;
    dot.style.color = color;
    const marker = new maplibregl.Marker({ element: dot }).setLngLat([lon, lat]).addTo(map);
    map.on("load", () => {
      const zoom = precision === "country" ? 2.2 : 3.4;
      if (reduce) map.jumpTo({ center: [lon, lat], zoom });
      else map.flyTo({ center: [lon, lat], zoom, duration: 1800, essential: true });
    });
    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lon, color, dark, precision]);
  return <div ref={el} className="h-[180px] w-full overflow-hidden rounded-2xl bg-surface-2" aria-hidden />;
}
