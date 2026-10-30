"use client";

import { useState } from "react";
import { currentPosition } from "@/lib/native";
import { CloudSun, LocateFixed } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/store";
import { weatherIcon, weatherLabel } from "@/lib/weather-codes";
import type { WeatherForecast } from "@/server/providers/openmeteo";
import { Card, CardHeader, DataMeta, ErrorState, ListSkeleton, cn } from "../ui";
import { AirQualityRow } from "./extra-widgets";

export interface WxLocation {
  name: string;
  lat: number;
  lon: number;
}

const DEFAULT_LOC: WxLocation = { name: "Berlin", lat: 52.52, lon: 13.41 };

export function useWeatherLocation() {
  const places = usePrefs((s) => s.places);
  const homeId = usePrefs((s) => s.homePlaceId);
  const [geo, setGeo] = useState<WxLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const home = places.find((p) => p.id === homeId);
  const loc: WxLocation = geo ?? (home ? { name: home.name, lat: home.lat, lon: home.lon } : DEFAULT_LOC);
  const locate = (label: string) => {
    currentPosition()
      .then((p) => {
        setGeo({ name: label, lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 });
        setGeoError(null);
      })
      .catch((e: Error) => setGeoError(e.message));
  };
  return { loc, locate, geoError, setLoc: setGeo };
}

function hourLabel(unix: number, offset: number) {
  // Open-Meteo returns unix times; show the forecast location's local hour.
  return new Date((unix + offset) * 1000).getUTCHours().toString().padStart(2, "0");
}

/** Background tint that follows the current sky (clear/cloudy/rain/snow/storm, day/night). */
function skyGradient(code: number | null, isDay: boolean): string {
  const c = code ?? 0;
  if (!isDay) return c >= 51 ? "from-[#1b2550]/70 to-[#0b1024]/40" : "from-[#1d2a6b]/60 via-[#3a2a6e]/35 to-transparent";
  if (c >= 95) return "from-[#4b3a7a]/60 to-[#1f2240]/30";
  if (c >= 71 && c <= 86) return "from-[#c9d8ec]/50 to-[#8ea9c9]/20";
  if (c >= 51) return "from-[#3a6ea5]/55 to-[#25476e]/25";
  if (c >= 45) return "from-[#9aa5b4]/45 to-[#6b7686]/20";
  if (c >= 2) return "from-[#6fa8dc]/45 to-[#a0b8d0]/20";
  return "from-[#ffb340]/45 via-[#5ab0ff]/30 to-transparent";
}

/** Smooth temperature curve for the next hours. */
function TempCurve({ temps }: { temps: (number | null)[] }) {
  const vals = temps.filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = temps.map((v, i) => [(i / (temps.length - 1)) * 100, 26 - (((v ?? min) - min) / span) * 22] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <defs>
        <linearGradient id="tempfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffb340" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb340" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,30 L0,30 Z`} fill="url(#tempfill)" />
      <path d={line} fill="none" stroke="#ffb340" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function WeatherSummary({ wx, compact }: { wx: WeatherForecast; compact?: boolean }) {
  const { t, lang } = useT();
  const c = wx.current;
  const nowIdx = Math.max(0, wx.hourly.time.findIndex((h) => h >= c.time - 3600));
  const hours = wx.hourly.time.slice(nowIdx, nowIdx + 24).map((h, i) => ({
    h,
    temp: wx.hourly.temperature_2m[nowIdx + i],
    code: wx.hourly.weather_code[nowIdx + i],
    pop: wx.hourly.precipitation_probability[nowIdx + i],
  }));
  return (
    <div className={cn("mx-2 rounded-[18px] bg-gradient-to-br pt-3 pb-2", skyGradient(c.weather_code, c.is_day !== 0))}>
      <div className="flex items-center gap-4 px-3">
        <div className="pop text-[52px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]" aria-hidden>{weatherIcon(c.weather_code)}</div>
        <div>
          <div className="text-[40px] leading-none font-semibold tracking-tight tabular">{c.temperature_2m != null ? Math.round(c.temperature_2m) : "–"}°</div>
          <div className="text-[14px] text-text-2">{weatherLabel(c.weather_code, lang)}</div>
        </div>
        <dl className="ml-auto grid grid-cols-[auto_auto] gap-x-2 text-[12px] text-text-2 tabular">
          <dt>{t("weather.feelsLike")}</dt><dd className="text-right text-text">{c.apparent_temperature != null ? Math.round(c.apparent_temperature) : "–"}°</dd>
          <dt>{t("weather.wind")}</dt><dd className="text-right text-text">{c.wind_speed_10m ?? "–"} km/h</dd>
          <dt>{t("weather.gusts")}</dt><dd className="text-right text-text">{c.wind_gusts_10m ?? "–"} km/h</dd>
          <dt>{t("weather.precip")}</dt><dd className="text-right text-text">{c.precipitation ?? 0} mm</dd>
        </dl>
      </div>
      <div className="px-3 pt-2"><TempCurve temps={hours.slice(0, compact ? 12 : 24).map((h) => h.temp)} /></div>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-3 pb-1" aria-label={t("weather.next24")}>
        {hours.slice(0, compact ? 12 : 24).map((h) => (
          <div key={h.h} className="flex shrink-0 flex-col items-center gap-0.5 text-[12px] tabular">
            <span className="text-text-2">{hourLabel(h.h, wx.utc_offset_seconds)}</span>
            <span aria-hidden>{weatherIcon(h.code)}</span>
            <span className="font-medium">{h.temp != null ? Math.round(h.temp) : "–"}°</span>
            {h.pop != null && h.pop > 0 && <span className="text-[10px] text-blue">{h.pop}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeatherDaily({ wx }: { wx: WeatherForecast }) {
  const { lang } = useT();
  const d = wx.daily;
  const min = Math.min(...d.temperature_2m_min.filter((v): v is number => v != null));
  const max = Math.max(...d.temperature_2m_max.filter((v): v is number => v != null));
  return (
    <ul className="divide-y divide-[var(--separator)]">
      {d.time.map((day, i) => {
        const lo = d.temperature_2m_min[i];
        const hi = d.temperature_2m_max[i];
        const left = lo != null ? ((lo - min) / (max - min || 1)) * 100 : 0;
        const width = lo != null && hi != null ? ((hi - lo) / (max - min || 1)) * 100 : 0;
        return (
          <li key={day} className="flex items-center gap-3 px-4 py-2.5 text-[15px] tabular">
            <span className="w-12 text-text-2">{new Date((day + wx.utc_offset_seconds) * 1000).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { weekday: "short", timeZone: "UTC" })}</span>
            <span aria-hidden className="w-7">{weatherIcon(d.weather_code[i])}</span>
            <span className="w-9 text-right text-text-2">{lo != null ? Math.round(lo) : "–"}°</span>
            <span className="relative h-1.5 flex-1 rounded-full bg-surface-2">
              <span className="absolute h-full rounded-full bg-gradient-to-r from-[#64d2ff] to-[#ffd60a]" style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }} />
            </span>
            <span className="w-9">{hi != null ? Math.round(hi) : "–"}°</span>
            <span className="w-12 text-right text-[12px] text-blue">{d.precipitation_sum[i] ? `${d.precipitation_sum[i]} mm` : ""}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function WeatherWidget() {
  const { t } = useT();
  const { loc, locate, geoError } = useWeatherLocation();
  const q = useProvider<WeatherForecast>("weather", { lat: loc.lat, lon: loc.lon });
  return (
    <Card>
      <CardHeader
        title={`${t("widget.weather")} · ${loc.name}`}
        icon={<CloudSun size={18} />}
        href="/explore/weather"
        action={
          <button onClick={() => locate(t("time.local"))} className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-accent" aria-label={t("weather.useLocation")}>
            <LocateFixed size={16} />
          </button>
        }
      />
      {q.isPending ? <ListSkeleton rows={2} /> : q.data?.data ? <WeatherSummary wx={q.data.data} compact /> : <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} compact />}
      <AirQualityRow lat={loc.lat} lon={loc.lon} />
      {geoError && <div className="px-4 pt-1 text-[11px] text-red">{geoError}</div>}
      <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
    </Card>
  );
}
