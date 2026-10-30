"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Country outlines (Natural Earth 1:110m, bundled in /public/basemap) for
 * point-in-country lookups of events with exact coordinates. Coarse borders:
 * points within a few km of a border can be attributed to the neighbour.
 */
export interface CountryShape {
  iso2: string;
  name: string;
  bbox: [number, number, number, number];
  polygons: [number, number][][][];
}

type Ring = [number, number][];

function ringBbox(rings: Ring[][], into: [number, number, number, number]) {
  for (const poly of rings) for (const [x, y] of poly[0]) {
    into[0] = Math.min(into[0], x);
    into[1] = Math.min(into[1], y);
    into[2] = Math.max(into[2], x);
    into[3] = Math.max(into[3], y);
  }
}

export function parseShapes(geo: GeoJSON.FeatureCollection): CountryShape[] {
  const out: CountryShape[] = [];
  for (const f of geo.features) {
    const iso2 = (f.properties as { iso2?: string | null })?.iso2;
    if (!iso2 || !f.geometry) continue;
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const polygons = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Ring[][];
    const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    ringBbox(polygons, bbox);
    out.push({ iso2, name: String((f.properties as { name?: string }).name ?? iso2), bbox, polygons });
  }
  return out;
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inShape(x: number, y: number, s: CountryShape): boolean {
  if (x < s.bbox[0] || x > s.bbox[2] || y < s.bbox[1] || y > s.bbox[3]) return false;
  return s.polygons.some((poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((hole) => inRing(x, y, hole)));
}

/** ISO2 of the country containing the point, or null (sea, tiny islands). */
export function countryAt(lat: number, lon: number, shapes: CountryShape[]): string | null {
  for (const s of shapes) {
    // Antimeridian-crossing outlines (Russia, Fiji) are stored with longitudes shifted by +360.
    if (inShape(lon, lat, s) || (lon < 0 && inShape(lon + 360, lat, s))) return s.iso2;
  }
  return null;
}

export function useCountryShapes() {
  return useQuery({
    queryKey: ["country-shapes"],
    queryFn: async () => {
      const r = await fetch("/basemap/countries-110m.geojson");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return parseShapes((await r.json()) as GeoJSON.FeatureCollection);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
