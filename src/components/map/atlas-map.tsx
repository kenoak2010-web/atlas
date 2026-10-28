"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, LngLatBoundsLike, Map as MLMap, ErrorEvent as MLErrorEvent, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { BASEMAP, COLORS, offlineStyle } from "./styles";
import type { MapLayerId } from "@/lib/store";
import { useSelection, type Selection } from "@/lib/selection";

export interface MapFeature {
  id: string;
  lat: number;
  lon: number;
  props?: Record<string, string | number | boolean | null>;
  select?: Selection;
}

export type LayerData = Partial<Record<MapLayerId, MapFeature[]>>;

export interface AtlasMapProps {
  data: LayerData;
  visible: MapLayerId[];
  dark: boolean;
  interactive?: boolean;
  initial?: { center: [number, number]; zoom: number };
  flyTo?: { lat: number; lon: number; zoom?: number; bbox?: [number, number, number, number] | null; key: number } | null;
  onViewChange?: (v: { bounds: [number, number, number, number]; zoom: number; center: [number, number] }) => void;
  onBasemapFallback?: () => void;
}

// Worker is served from /public (see scripts/copy-maplibre-worker.mjs).
if (typeof window !== "undefined") maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`);

const CLUSTERED: MapLayerId[] = ["news", "disasters", "humanitarian", "wildfires"];

function toGeoJSON(features: MapFeature[] = []): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      id: undefined,
      properties: { ...f.props, _id: f.id },
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
    })),
  };
}

function planeImage(): ImageData {
  const s = 32;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = COLORS.aircraft;
  g.strokeStyle = "#fff";
  g.lineWidth = 1.5;
  g.beginPath();
  // simple aircraft silhouette pointing north
  g.moveTo(16, 2);
  g.lineTo(19, 12);
  g.lineTo(30, 18);
  g.lineTo(30, 21);
  g.lineTo(19, 18);
  g.lineTo(18, 26);
  g.lineTo(22, 29);
  g.lineTo(22, 31);
  g.lineTo(16, 29.5);
  g.lineTo(10, 31);
  g.lineTo(10, 29);
  g.lineTo(14, 26);
  g.lineTo(13, 18);
  g.lineTo(2, 21);
  g.lineTo(2, 18);
  g.lineTo(13, 12);
  g.closePath();
  g.fill();
  g.stroke();
  return g.getImageData(0, 0, s, s);
}

function addLayers(map: MLMap) {
  if (!map.hasImage("plane")) map.addImage("plane", planeImage(), { pixelRatio: 2 });
  const font = ["Noto Sans Regular"];
  const add = (id: MapLayerId) => {
    if (map.getSource(id)) return;
    map.addSource(id, {
      type: "geojson",
      data: toGeoJSON(),
      ...(CLUSTERED.includes(id) ? { cluster: true, clusterRadius: 40, clusterMaxZoom: 6 } : {}),
    });
  };
  (["news", "quakes", "disasters", "weather", "alerts", "wildfires", "volcanoes", "humanitarian", "aircraft", "iss"] as MapLayerId[]).forEach(add);

  const clusterLayers = (id: MapLayerId, color: string) => {
    map.addLayer({
      id: `${id}-clusters`,
      type: "circle",
      source: id,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": color,
        "circle-opacity": 0.85,
        "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 50, 22],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });
    map.addLayer({
      id: `${id}-count`,
      type: "symbol",
      source: id,
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": font, "text-size": 12, "text-allow-overlap": true },
      paint: { "text-color": "#fff" },
    });
  };

  clusterLayers("humanitarian", COLORS.humanitarian);
  map.addLayer({ id: "humanitarian-points", type: "circle", source: "humanitarian", filter: ["!", ["has", "point_count"]], paint: { "circle-color": COLORS.humanitarian, "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

  clusterLayers("wildfires", COLORS.fire);
  map.addLayer({
    id: "wildfires-points",
    type: "circle",
    source: "wildfires",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": COLORS.fire, "circle-radius": ["case", ["==", ["get", "kind"], "hotspot"], 3, 6], "circle-opacity": 0.85, "circle-stroke-width": ["case", ["==", ["get", "kind"], "hotspot"], 0, 1.5], "circle-stroke-color": "#fff" },
  });

  map.addLayer({ id: "volcanoes-points", type: "circle", source: "volcanoes", paint: { "circle-color": COLORS.volcano, "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

  map.addLayer({
    id: "weather-points",
    type: "circle",
    source: "weather",
    paint: {
      "circle-radius": 9,
      "circle-color": ["interpolate", ["linear"], ["coalesce", ["get", "temp"], 15], -20, "#5e5ce6", 0, "#64d2ff", 15, "#30d158", 25, "#ffd60a", 35, "#ff453a"],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#fff",
      "circle-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "weather-labels",
    type: "symbol",
    source: "weather",
    layout: { "text-field": ["concat", ["to-string", ["round", ["coalesce", ["get", "temp"], 0]]], "°"], "text-font": font, "text-size": 11, "text-offset": [0, 1.4], "text-allow-overlap": false },
    paint: { "text-color": "#000", "text-halo-color": "#fff", "text-halo-width": 1.5 },
  });

  map.addLayer({ id: "alerts-points", type: "circle", source: "alerts", paint: { "circle-color": COLORS.alert, "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

  clusterLayers("disasters", COLORS.disaster);
  map.addLayer({
    id: "disasters-points",
    type: "circle",
    source: "disasters",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": ["match", ["get", "level"], "Red", "#ff453a", "Orange", "#ff9f0a", COLORS.disaster], "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
  });

  map.addLayer({
    id: "quakes-points",
    type: "circle",
    source: "quakes",
    paint: {
      "circle-color": ["interpolate", ["linear"], ["get", "mag"], 2.5, "#ffd60a", 5, COLORS.quake, 6.5, COLORS.quakeStrong],
      "circle-radius": ["interpolate", ["exponential", 1.6], ["get", "mag"], 2.5, 3, 5, 7, 7, 16, 8.5, 26],
      "circle-opacity": ["interpolate", ["linear"], ["get", "ageH"], 0, 0.95, 168, 0.4],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff",
    },
  });

  clusterLayers("news", COLORS.news);
  map.addLayer({
    id: "news-points",
    type: "circle",
    source: "news",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": ["case", ["get", "breaking"], "#ff453a", COLORS.news], "circle-radius": ["interpolate", ["linear"], ["get", "sources"], 1, 6, 5, 11], "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
  });

  map.addLayer({
    id: "aircraft-points",
    type: "symbol",
    source: "aircraft",
    layout: { "icon-image": "plane", "icon-size": 0.9, "icon-rotate": ["coalesce", ["get", "heading"], 0], "icon-rotation-alignment": "map", "icon-allow-overlap": true },
  });

  map.addLayer({ id: "iss-halo", type: "circle", source: "iss", paint: { "circle-color": COLORS.iss, "circle-radius": 16, "circle-opacity": 0.25 } });
  map.addLayer({ id: "iss-points", type: "circle", source: "iss", paint: { "circle-color": COLORS.iss, "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#000" } });
}

const LAYER_IDS: Record<MapLayerId, string[]> = {
  news: ["news-clusters", "news-count", "news-points"],
  quakes: ["quakes-points"],
  disasters: ["disasters-clusters", "disasters-count", "disasters-points"],
  weather: ["weather-points", "weather-labels"],
  alerts: ["alerts-points"],
  wildfires: ["wildfires-clusters", "wildfires-count", "wildfires-points"],
  volcanoes: ["volcanoes-points"],
  humanitarian: ["humanitarian-clusters", "humanitarian-count", "humanitarian-points"],
  aircraft: ["aircraft-points"],
  iss: ["iss-halo", "iss-points"],
};

const CLICKABLE = Object.values(LAYER_IDS).flat().filter((l) => !l.endsWith("-count") && !l.endsWith("-labels") && l !== "iss-halo");

export default function AtlasMap({ data, visible, dark, interactive = true, initial, flyTo, onViewChange, onBasemapFallback }: AtlasMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(0);
  const lookup = useRef(new Map<string, Selection>());
  const select = useSelection((s) => s.select);
  const viewCb = useRef(onViewChange);
  const fallbackCb = useRef(onBasemapFallback);
  const darkRef = useRef(dark);
  const offline = useRef(false);
  useEffect(() => {
    viewCb.current = onViewChange;
    fallbackCb.current = onBasemapFallback;
    darkRef.current = dark;
  });

  // Create map once.
  useEffect(() => {
    if (!ref.current) return;
    let usedFallback = false;
    const map = new maplibregl.Map({
      container: ref.current,
      style: dark ? BASEMAP.dark : BASEMAP.light,
      center: initial?.center ?? [15, 25],
      zoom: initial?.zoom ?? 1.2,
      attributionControl: false,
      interactive,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: true,
      cooperativeGestures: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e: MLErrorEvent) => {
      // Style could not be loaded (network/tile host down) → switch to fallback once.
      const msg = String(e.error?.message ?? "");
      if (!usedFallback && !map.isStyleLoaded() && /style|fetch|Failed/i.test(msg)) {
        usedFallback = true;
        offline.current = true;
        map.setStyle(offlineStyle(darkRef.current));
        fallbackCb.current?.();
      }
    });
    map.on("style.load", () => {
      addLayers(map);
      setReady((r) => r + 1);
    });
    const emit = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      viewCb.current?.({ bounds: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()], zoom: map.getZoom(), center: [c.lng, c.lat] });
    };
    map.on("moveend", emit);
    map.on("load", emit);

    map.on("click", (e: MapMouseEvent) => {
      const layers = CLICKABLE.filter((l) => map.getLayer(l));
      const hits = map.queryRenderedFeatures(e.point, { layers });
      const f = hits[0];
      if (!f) return;
      const src = f.source as MapLayerId;
      if (f.properties?.cluster) {
        const s = map.getSource(src) as GeoJSONSource;
        s.getClusterExpansionZoom(f.properties.cluster_id as number).then((z) => map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.5 }));
        return;
      }
      const sel = lookup.current.get(String(f.properties?._id));
      if (sel) select(sel);
    });
    for (const l of CLICKABLE) {
      map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
    }
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switch → reload basemap style (custom layers are re-added on style.load).
  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    mapRef.current?.setStyle(offline.current ? offlineStyle(dark) : dark ? BASEMAP.dark : BASEMAP.light);
  }, [dark]);

  // Push data into sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lk = new Map<string, Selection>();
    for (const [layer, feats] of Object.entries(data) as [MapLayerId, MapFeature[]][]) {
      const src = map.getSource(layer) as GeoJSONSource | undefined;
      src?.setData(toGeoJSON(feats));
      for (const f of feats ?? []) if (f.select) lk.set(f.id, f.select);
    }
    lookup.current = lk;
  }, [data, ready]);

  // Layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [layer, ids] of Object.entries(LAYER_IDS) as [MapLayerId, string[]][]) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible.includes(layer) ? "visible" : "none");
    }
  }, [visible, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.bbox) {
      const [w, s, e, n] = flyTo.bbox;
      map.fitBounds([[w, s], [e, n]] as LngLatBoundsLike, { padding: 40, maxZoom: 9 });
    } else map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom ?? 6 });
  }, [flyTo]);

  return <div ref={ref} className="h-full w-full" role="application" aria-label="Weltkarte" />;
}
