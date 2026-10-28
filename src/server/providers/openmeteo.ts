import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";
import { WEATHER_CITIES } from "@/lib/weather-cities";

const num = z.number().nullable();
const arr = z.array(num);

const Forecast = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  utc_offset_seconds: z.number(),
  elevation: z.number().optional(),
  current: z.object({
    time: z.number(),
    temperature_2m: num,
    apparent_temperature: num,
    relative_humidity_2m: num,
    precipitation: num,
    weather_code: num,
    wind_speed_10m: num,
    wind_direction_10m: num,
    wind_gusts_10m: num,
    is_day: num,
  }),
  hourly: z.object({
    time: z.array(z.number()),
    temperature_2m: arr,
    precipitation_probability: arr,
    weather_code: arr,
  }),
  daily: z.object({
    time: z.array(z.number()),
    weather_code: arr,
    temperature_2m_max: arr,
    temperature_2m_min: arr,
    precipitation_sum: arr,
    wind_speed_10m_max: arr,
    sunrise: z.array(z.number()),
    sunset: z.array(z.number()),
  }),
});

export type WeatherForecast = z.infer<typeof Forecast>;

const coord = (min: number, max: number) => z.coerce.number().min(min).max(max).transform((n) => Math.round(n * 100) / 100);

export const weatherProvider = defineProvider({
  id: "weather",
  label: "Open-Meteo Forecast",
  category: "weather",
  refreshSeconds: 900,
  freshnessClass: "periodic",
  attribution: { name: "Open-Meteo.com", url: "https://open-meteo.com/", license: "CC BY 4.0 (data); free for non-commercial use" },
  rateLimit: "No key; < 10,000 calls/day for non-commercial use.",
  note: "Model forecast data, updated hourly. Not an official warning service.",
  params: z.object({ lat: coord(-90, 90), lon: coord(-180, 180) }),
  cacheKey: (p) => `${p.lat},${p.lon}`,
  async fetch(p) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(p.lat),
      longitude: String(p.lon),
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset",
      timezone: "auto",
      timeformat: "unixtime",
      forecast_days: "7",
      wind_speed_unit: "kmh",
    }).toString();
    const data = Forecast.parse(await fetchJson(url.toString()));
    return { data, sourceUpdatedAt: new Date(data.current.time * 1000).toISOString() };
  },
});

const CityCurrent = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: z.object({
    time: z.number(),
    temperature_2m: num,
    weather_code: num,
    wind_speed_10m: num,
    precipitation: num,
    is_day: num,
  }),
});

export interface CityWeather {
  name: string;
  lat: number;
  lon: number;
  time: string;
  temperature: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  isDay: boolean;
}

/** Current conditions for a fixed set of world cities (one batched request). */
export const worldWeatherProvider = defineProvider({
  id: "world-weather",
  label: "Open-Meteo – world cities",
  category: "weather",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: weatherProvider.attribution,
  rateLimit: weatherProvider.rateLimit,
  note: "Current model conditions for selected major cities.",
  params: z.object({}),
  cacheKey: () => "cities",
  async fetch() {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: WEATHER_CITIES.map((c) => c.lat).join(","),
      longitude: WEATHER_CITIES.map((c) => c.lon).join(","),
      current: "temperature_2m,weather_code,wind_speed_10m,precipitation,is_day",
      timeformat: "unixtime",
    }).toString();
    const rows = z.array(CityCurrent).parse(await fetchJson(url.toString()));
    const data: CityWeather[] = rows.map((r, i) => ({
      name: WEATHER_CITIES[i].name,
      lat: WEATHER_CITIES[i].lat,
      lon: WEATHER_CITIES[i].lon,
      time: new Date(r.current.time * 1000).toISOString(),
      temperature: r.current.temperature_2m,
      weatherCode: r.current.weather_code,
      windSpeed: r.current.wind_speed_10m,
      precipitation: r.current.precipitation,
      isDay: r.current.is_day === 1,
    }));
    const newest = data.reduce((m, d) => (d.time > m ? d.time : m), "");
    return { data, sourceUpdatedAt: newest || null };
  },
});
