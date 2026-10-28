import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";

export interface Place {
  name: string;
  detail: string;
  lat: number;
  lon: number;
  countryCode: string | null;
  kind: string;
  bbox: [number, number, number, number] | null;
}

const PhotonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z
    .object({
      name: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      countrycode: z.string().optional(),
      osm_value: z.string().optional(),
      type: z.string().optional(),
      extent: z.array(z.number()).length(4).optional(),
    })
    .passthrough(),
});

export const geocodeProvider = defineProvider({
  id: "geocode",
  label: "Photon geocoder (OpenStreetMap data)",
  category: "search",
  refreshSeconds: 86400,
  freshnessClass: "periodic",
  attribution: { name: "Photon by Komoot · © OpenStreetMap contributors", url: "https://photon.komoot.io", license: "ODbL" },
  rateLimit: "Fair use; no heavy/bulk usage. ATLAS debounces input and caches results for 24 h.",
  params: z.object({ q: z.string().trim().min(2).max(100), lang: z.enum(["de", "en"]).default("de") }),
  cacheKey: (p) => `${p.lang}:${p.q.toLowerCase()}`,
  async fetch(p) {
    const raw = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(p.q)}&limit=8&lang=${p.lang}`);
    const parsed = z.object({ features: z.array(z.unknown()) }).parse(raw);
    const data: Place[] = parsed.features.flatMap((f) => {
      const r = PhotonFeature.safeParse(f);
      if (!r.success || !r.data.properties.name) return [];
      const pr = r.data.properties;
      const [lon, lat] = r.data.geometry.coordinates;
      const e = pr.extent;
      return [
        {
          name: pr.name!,
          detail: [pr.city !== pr.name ? pr.city : null, pr.state, pr.country].filter(Boolean).join(", "),
          lat,
          lon,
          countryCode: pr.countrycode ?? null,
          kind: pr.osm_value ?? pr.type ?? "place",
          bbox: e ? [e[0], e[3], e[2], e[1]] : null, // photon: [minLon, maxLat, maxLon, minLat] → [w,s,e,n]
        },
      ];
    });
    return { data };
  },
});
