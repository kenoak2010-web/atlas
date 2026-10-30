import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";

const coord = (min: number, max: number) => z.coerce.number().min(min).max(max).transform((v) => Math.round(v * 100) / 100);

// ---------------------------------------------------------------- Air quality

const AirResponse = z.object({
  current: z.object({
    time: z.number(),
    european_aqi: z.number().nullable().optional(),
    us_aqi: z.number().nullable().optional(),
    pm2_5: z.number().nullable().optional(),
    pm10: z.number().nullable().optional(),
    ozone: z.number().nullable().optional(),
    nitrogen_dioxide: z.number().nullable().optional(),
  }),
});

export interface AirQuality {
  time: string;
  europeanAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  no2: number | null;
}

export const airQualityProvider = defineProvider({
  id: "air-quality",
  label: "Open-Meteo Air Quality (CAMS)",
  category: "weather",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: { name: "Open-Meteo / Copernicus CAMS", url: "https://open-meteo.com/en/docs/air-quality-api", license: "CC BY 4.0" },
  rateLimit: "No key; < 10,000 calls/day for non-commercial use.",
  note: "Modelled values (CAMS), hourly – not a ground station measurement.",
  params: z.object({ lat: coord(-90, 90), lon: coord(-180, 180) }),
  cacheKey: (p) => `${p.lat},${p.lon}`,
  async fetch(p) {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.search = new URLSearchParams({
      latitude: String(p.lat),
      longitude: String(p.lon),
      current: "european_aqi,us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide",
      timezone: "auto",
      timeformat: "unixtime",
    }).toString();
    const c = AirResponse.parse(await fetchJson(url.toString())).current;
    const data: AirQuality = {
      time: new Date(c.time * 1000).toISOString(),
      europeanAqi: c.european_aqi ?? null,
      usAqi: c.us_aqi ?? null,
      pm25: c.pm2_5 ?? null,
      pm10: c.pm10 ?? null,
      ozone: c.ozone ?? null,
      no2: c.nitrogen_dioxide ?? null,
    };
    return { data, sourceUpdatedAt: data.time };
  },
});

/** European AQI bands (EEA): 0–20 good … >100 extremely poor. */
export function eaqiBand(v: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (v <= 20) return 0;
  if (v <= 40) return 1;
  if (v <= 60) return 2;
  if (v <= 80) return 3;
  if (v <= 100) return 4;
  return 5;
}

// ---------------------------------------------------------------- NASA EPIC

const EpicItem = z.object({
  identifier: z.string(),
  image: z.string().regex(/^[\w-]+$/),
  caption: z.string().optional(),
  date: z.string(),
  centroid_coordinates: z.object({ lat: z.number(), lon: z.number() }),
});

export interface EpicImage {
  id: string;
  time: string;
  image: string;
  thumb: string;
  centroid: { lat: number; lon: number };
}

/** "2026-10-26 00:50:27" (UTC) → ISO */
export function epicDate(s: string): string | null {
  const t = Date.parse(`${s.replace(" ", "T")}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export const epicProvider = defineProvider({
  id: "epic",
  label: "NASA EPIC – full-disc Earth images (DSCOVR)",
  category: "space",
  refreshSeconds: 3 * 3600,
  freshnessClass: "delayed",
  attribution: { name: "NASA EPIC Team / NOAA DSCOVR", url: "https://epic.gsfc.nasa.gov" },
  rateLimit: "No key; public archive.",
  note: "Real photos of the sunlit Earth from 1.5 million km, published 12–48 h after capture.",
  params: z.object({}),
  cacheKey: () => "natural",
  async fetch() {
    const items = z.array(EpicItem).parse(await fetchJson("https://epic.gsfc.nasa.gov/api/natural", { timeoutMs: 20_000 }));
    const data: EpicImage[] = items.flatMap((i) => {
      const time = epicDate(i.date);
      if (!time) return [];
      const [y, m, d] = time.slice(0, 10).split("-");
      const base = `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}`;
      return [{ id: i.identifier, time, image: `${base}/jpg/${i.image}.jpg`, thumb: `${base}/thumbs/${i.image}.jpg`, centroid: i.centroid_coordinates }];
    });
    return { data, sourceUpdatedAt: data.at(-1)?.time ?? null };
  },
});

// ---------------------------------------------------------------- Wikipedia "On this day"

const OnThisDay = z.object({
  selected: z
    .array(
      z.object({
        text: z.string(),
        year: z.number(),
        pages: z
          .array(
            z.object({
              titles: z.object({ normalized: z.string() }).optional(),
              thumbnail: z.object({ source: z.string().url() }).optional(),
              content_urls: z.object({ mobile: z.object({ page: z.string().url() }) }).optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export interface HistoryEvent {
  year: number;
  text: string;
  title: string | null;
  url: string | null;
  thumb: string | null;
}

export const onThisDayProvider = defineProvider({
  id: "on-this-day",
  label: "Wikipedia – On this day",
  category: "news",
  refreshSeconds: 6 * 3600,
  freshnessClass: "periodic",
  attribution: { name: "Wikipedia (Wikimedia Feed API)", url: "https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day", license: "CC BY-SA 4.0" },
  rateLimit: "No key; Wikimedia API etiquette (User-Agent, caching).",
  note: "Selected anniversaries chosen by Wikipedia editors.",
  params: z.object({ lang: z.enum(["de", "en"]).default("de"), md: z.string().regex(/^\d{2}-\d{2}$/) }),
  cacheKey: (p) => `${p.lang}:${p.md}`,
  async fetch(p) {
    const [mm, dd] = p.md.split("-");
    const raw = await fetchJson(`https://api.wikimedia.org/feed/v1/wikipedia/${p.lang}/onthisday/selected/${mm}/${dd}`, { timeoutMs: 15_000 });
    const data: HistoryEvent[] = OnThisDay.parse(raw)
      .selected.map((e) => {
        const page = e.pages[0];
        return { year: e.year, text: e.text.replace(/­/g, ""), title: page?.titles?.normalized ?? null, url: page?.content_urls?.mobile.page ?? null, thumb: page?.thumbnail?.source ?? null };
      })
      .sort((a, b) => b.year - a.year);
    return { data, sourceUpdatedAt: null };
  },
});
