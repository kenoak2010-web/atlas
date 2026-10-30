"use client";

import { useMemo, useState } from "react";
import { History, Moon, Orbit, Sunrise, Sunset, Wind } from "lucide-react";
import { useProvider } from "@/lib/api";
import { moonPhase, sunTimes, type MoonPhaseKey } from "@/lib/astro";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import type { AirQuality, EpicImage, HistoryEvent } from "@/server/providers/extras";
import type { SpaceWeather } from "@/server/providers/space";
import { useNews } from "../news";
import { useSelection } from "@/lib/selection";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, cn, useMounted, useNow } from "../ui";
import { useWeatherLocation } from "./weather";

const de = (lang: string) => lang === "de";

// ---------------------------------------------------------------- Ticker

/** Scrolling headline ticker (top stories, breaking first). Tap opens the story. */
export function NewsTicker() {
  const { lang } = useT();
  const news = useNews();
  const select = useSelection((s) => s.select);
  const items = useMemo(() => [...news.clusters].sort((a, b) => Number(b.breaking) - Number(a.breaking)).slice(0, 12), [news.clusters]);
  if (!items.length) return null;
  const row = (dup: boolean) =>
    items.map((c) => (
      <button
        key={`${dup ? "b" : "a"}-${c.id}`}
        tabIndex={dup ? -1 : 0}
        aria-hidden={dup || undefined}
        onClick={() => select({ type: "news", cluster: c })}
        className="inline-flex shrink-0 items-center gap-2 px-4 text-[13px] font-medium whitespace-nowrap"
      >
        {c.breaking ? (
          <span className="rounded-[5px] bg-red px-1.5 text-[10px] font-bold tracking-wider text-white uppercase">{de(lang) ? "Eil" : "Breaking"}</span>
        ) : (
          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
        )}
        {c.title}
        <span className="text-text-3">{c.articles[0]?.sourceName}</span>
      </button>
    ));
  return (
    <div className="card mask-fade-x overflow-hidden py-2.5" role="region" aria-label={de(lang) ? "Schlagzeilen-Laufband" : "Headline ticker"}>
      <div className="marquee flex w-max" style={{ ["--marquee-duration" as string]: `${items.length * 7}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Activity index

interface Contribution {
  label: string;
  count: number;
  points: number;
}

/**
 * Global activity index (0–100): a transparent sum of weighted, currently
 * reported events. It measures how much is happening in the data ATLAS
 * tracks – it is not an official risk rating.
 */
export function activityIndex(input: { quakes: AtlasEvent[]; gdacs: AtlasEvent[]; breaking: number; severeWeather: number }, lang: string) {
  const mag = (e: AtlasEvent) => Number(e.meta?.mag ?? 0);
  const q7 = input.quakes.filter((e) => mag(e) >= 7).length;
  const q6 = input.quakes.filter((e) => mag(e) >= 6 && mag(e) < 7).length;
  const q5 = input.quakes.filter((e) => mag(e) < 6).length;
  const red = input.gdacs.filter((e) => e.severity >= 4).length;
  const orange = input.gdacs.filter((e) => e.severity === 3).length;
  const parts: Contribution[] = [
    { label: de(lang) ? "Erdbeben M7+ (×12)" : "Quakes M7+ (×12)", count: q7, points: q7 * 12 },
    { label: de(lang) ? "Erdbeben M6–7 (×5)" : "Quakes M6–7 (×5)", count: q6, points: q6 * 5 },
    { label: de(lang) ? "Erdbeben M4.5–6 (×1)" : "Quakes M4.5–6 (×1)", count: q5, points: q5 },
    { label: de(lang) ? "GDACS Rot (×12)" : "GDACS red (×12)", count: red, points: red * 12 },
    { label: de(lang) ? "GDACS Orange (×5)" : "GDACS orange (×5)", count: orange, points: orange * 5 },
    { label: de(lang) ? "Eilmeldungen (×6)" : "Breaking stories (×6)", count: input.breaking, points: input.breaking * 6 },
    { label: de(lang) ? "Schwere Unwetter (×0,5)" : "Severe weather (×0.5)", count: input.severeWeather, points: input.severeWeather * 0.5 },
  ];
  const value = Math.min(100, Math.round(parts.reduce((s, p) => s + p.points, 0)));
  const level = value < 25 ? 0 : value < 50 ? 1 : value < 75 ? 2 : 3;
  return { value, level, parts };
}

const LEVELS = {
  de: ["Ruhig", "Erhöht", "Hoch", "Sehr hoch"],
  en: ["Calm", "Elevated", "High", "Very high"],
};

function Gauge({ value }: { value: number }) {
  const r = 52;
  const len = Math.PI * r;
  return (
    <svg viewBox="0 0 120 68" className="h-[92px] w-[160px]" aria-hidden>
      <defs>
        <linearGradient id="gauge" x1="0" x2="1">
          <stop offset="0" stopColor="#32e07a" />
          <stop offset="0.45" stopColor="#ffd60a" />
          <stop offset="0.75" stopColor="#ff9f0a" />
          <stop offset="1" stopColor="#ff4d5e" />
        </linearGradient>
      </defs>
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M8 62 A52 52 0 0 1 112 62"
        fill="none"
        stroke="url(#gauge)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - value / 100)}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
    </svg>
  );
}

export function ActivityWidget() {
  const { lang } = useT();
  const [open, setOpen] = useState(false);
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const dwd = useProvider<AtlasEvent[]>("alerts-de");
  const nws = useProvider<AtlasEvent[]>("alerts-us");
  const news = useNews();
  const ready = !!quakes.data?.data && !!gdacs.data?.data && !!news.data?.data;
  const idx = useMemo(
    () =>
      activityIndex(
        {
          quakes: quakes.data?.data ?? [],
          gdacs: gdacs.data?.data ?? [],
          breaking: news.clusters.filter((c) => c.breaking).length,
          severeWeather: (dwd.data?.data ?? []).filter((e) => e.severity >= 3).length + (nws.data?.data ?? []).length,
        },
        lang,
      ),
    [quakes.data, gdacs.data, news.clusters, dwd.data, nws.data, lang],
  );
  const color = ["text-green", "text-yellow", "text-orange", "text-red"][idx.level];
  return (
    <Card>
      <button className="flex w-full items-center gap-3 px-4 pt-4 pb-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="relative shrink-0">
          <Gauge value={ready ? idx.value : 0} />
          <div className="absolute inset-x-0 bottom-0 text-center">
            <div className="text-[30px] leading-none font-bold tracking-tight tabular">{ready ? idx.value : "–"}</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.16em] text-text-2 uppercase">{de(lang) ? "Globaler Aktivitätsindex" : "Global activity index"}</div>
          <div className={cn("text-[22px] font-bold tracking-tight", color)}>{ready ? LEVELS[de(lang) ? "de" : "en"][idx.level] : "…"}</div>
          <div className="text-[12px] text-text-2">{de(lang) ? "Gewichtete Summe aktueller Ereignisse · antippen für Formel" : "Weighted sum of current events · tap for formula"}</div>
        </div>
      </button>
      {open && (
        <ul className="mx-4 mb-2 space-y-1 rounded-2xl bg-surface-2 p-3 text-[12px]">
          {idx.parts.map((p) => (
            <li key={p.label} className="flex justify-between gap-2 tabular">
              <span className="text-text-2">{p.label}</span>
              <span>
                {p.count} → <b>{Math.round(p.points * 10) / 10}</b>
              </span>
            </li>
          ))}
          <li className="pt-1 text-[11px] text-text-3">
            {de(lang)
              ? "ATLAS-eigene Kennzahl, gedeckelt bei 100. Misst die Menge gemeldeter Ereignisse, keine offizielle Gefahrenstufe."
              : "ATLAS's own metric, capped at 100. Measures the volume of reported events, not an official threat level."}
          </li>
        </ul>
      )}
      <div className="grid grid-cols-4 gap-1 px-4 pb-4 pt-1 text-center">
        {[
          { n: quakes.data?.data?.length, l: de(lang) ? "Beben" : "Quakes" },
          { n: gdacs.data?.data?.filter((e) => e.severity >= 3).length, l: "GDACS ≥ 🟠" },
          { n: news.data?.data ? news.clusters.filter((c) => c.breaking).length : undefined, l: de(lang) ? "Eil" : "Breaking" },
          { n: dwd.data?.data || nws.data?.data ? (dwd.data?.data ?? []).filter((e) => e.severity >= 3).length + (nws.data?.data ?? []).length : undefined, l: de(lang) ? "Unwetter" : "Severe wx" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-surface-2 py-2">
            <div className="text-[18px] font-bold tabular">{s.n ?? "–"}</div>
            <div className="truncate text-[10px] text-text-2">{s.l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- World clocks

const CITIES = [
  { name: "Berlin", tz: "Europe/Berlin", lat: 52.52, lon: 13.4 },
  { name: "London", tz: "Europe/London", lat: 51.5, lon: -0.13 },
  { name: "New York", tz: "America/New_York", lat: 40.71, lon: -74 },
  { name: "Los Angeles", tz: "America/Los_Angeles", lat: 34.05, lon: -118.24 },
  { name: "Moskau", en: "Moscow", tz: "Europe/Moscow", lat: 55.75, lon: 37.62 },
  { name: "Dubai", tz: "Asia/Dubai", lat: 25.2, lon: 55.27 },
  { name: "Neu-Delhi", en: "New Delhi", tz: "Asia/Kolkata", lat: 28.61, lon: 77.21 },
  { name: "Peking", en: "Beijing", tz: "Asia/Shanghai", lat: 39.9, lon: 116.4 },
  { name: "Tokio", en: "Tokyo", tz: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Sydney", tz: "Australia/Sydney", lat: -33.87, lon: 151.21 },
];

function isDaylight(lat: number, lon: number, ms: number) {
  for (const off of [-86_400_000, 0, 86_400_000]) {
    const s = sunTimes(lat, lon, ms + off);
    if (s.polar) return s.polar === "day";
    if (ms >= Date.parse(s.sunrise!) && ms < Date.parse(s.sunset!)) return true;
  }
  return false;
}

export function WorldClocks() {
  const { t, lang } = useT();
  const mounted = useMounted();
  const now = useNow(1000);
  const tz = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-end justify-between px-4 pt-3.5">
        <div>
          <div className="text-[11px] font-bold tracking-[0.16em] text-text-2 uppercase" suppressHydrationWarning>
            {t("time.local")} · {tz.split("/").pop()?.replace("_", " ")}
          </div>
          <div className="text-gradient text-[44px] leading-none font-bold tracking-tight tabular" suppressHydrationWarning>
            {mounted ? formatTime(new Date(now), lang) : "––:––:––"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold tracking-[0.16em] text-text-2 uppercase">UTC</div>
          <div className="text-[20px] font-semibold tabular" suppressHydrationWarning>{mounted ? formatTime(new Date(now), lang, "UTC") : "––:––"}</div>
        </div>
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-3.5">
        {CITIES.map((c) => {
          const day = mounted && isDaylight(c.lat, c.lon, now);
          return (
            <div key={c.tz} className="shrink-0 rounded-2xl bg-surface-2 px-3 py-2">
              <div className="flex items-center gap-1 text-[11px] text-text-2">
                <span aria-hidden>{mounted ? (day ? "☀️" : "🌙") : ""}</span>
                {lang === "en" && c.en ? c.en : c.name}
              </div>
              <div className="text-[16px] font-semibold tabular" suppressHydrationWarning>
                {mounted ? new Date(now).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: c.tz }) : "––:––"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Sky (sun, moon, aurora)

const MOON_NAMES: Record<MoonPhaseKey, [string, string]> = {
  new: ["Neumond", "New moon"],
  waxingCrescent: ["Zunehmende Sichel", "Waxing crescent"],
  firstQuarter: ["Erstes Viertel", "First quarter"],
  waxingGibbous: ["Zunehmender Mond", "Waxing gibbous"],
  full: ["Vollmond", "Full moon"],
  waningGibbous: ["Abnehmender Mond", "Waning gibbous"],
  lastQuarter: ["Letztes Viertel", "Last quarter"],
  waningCrescent: ["Abnehmende Sichel", "Waning crescent"],
};

export function MoonIcon({ fraction, illumination, size = 56 }: { fraction: number; illumination: number; size?: number }) {
  const r = 24;
  const litRight = fraction < 0.5;
  const rx = Math.abs(Math.cos(2 * Math.PI * fraction)) * r;
  const outer = litRight ? 1 : 0;
  const inner = litRight ? (illumination < 0.5 ? 0 : 1) : illumination < 0.5 ? 1 : 0;
  return (
    <svg viewBox="-26 -26 52 52" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="moonlit" cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#fffbe8" />
          <stop offset="1" stopColor="#d9d3bd" />
        </radialGradient>
      </defs>
      <circle r={r} fill="#2a2f3d" />
      <path d={`M0 ${-r} A${r} ${r} 0 0 ${outer} 0 ${r} A${rx} ${r} 0 0 ${inner} 0 ${-r}Z`} fill="url(#moonlit)" />
      <circle r={r} fill="none" stroke="rgba(255,255,255,.15)" />
    </svg>
  );
}

export function SkyWidget() {
  const { lang } = useT();
  const mounted = useMounted();
  const now = useNow(60_000);
  const { loc } = useWeatherLocation();
  const sw = useProvider<SpaceWeather>("space-weather");
  const sun = sunTimes(loc.lat, loc.lon, now);
  const moon = moonPhase(now);
  const kp = sw.data?.data?.kp.at(-1)?.kp ?? null;
  const dayLen = sun.sunrise && sun.sunset ? (Date.parse(sun.sunset) - Date.parse(sun.sunrise)) / 3_600_000 : null;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : "–");
  return (
    <Card>
      <CardHeader title={de(lang) ? `Himmel · ${loc.name}` : `Sky · ${loc.name}`} icon={<Moon size={18} />} subtitle={de(lang) ? "Sonne und Mond berechnet, Kp von NOAA SWPC" : "Sun & moon computed, Kp from NOAA SWPC"} />
      {mounted && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#ffb340]/25 to-[#ff4d5e]/10 p-3">
            <div className="flex items-center gap-1.5 text-[12px] text-text-2"><Sunrise size={14} /> {fmt(sun.sunrise)}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-text-2"><Sunset size={14} /> {fmt(sun.sunset)}</div>
            <div className="mt-1 text-[20px] font-bold tabular">
              {sun.polar ? (sun.polar === "day" ? (de(lang) ? "Polartag" : "Polar day") : de(lang) ? "Polarnacht" : "Polar night") : `${Math.floor(dayLen!)} h ${Math.round((dayLen! % 1) * 60)} min`}
            </div>
            <div className="text-[11px] text-text-2">{de(lang) ? "Tageslänge" : "Day length"}</div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#3d9bff]/20 to-[#b16cff]/15 p-3">
            <MoonIcon fraction={moon.fraction} illumination={moon.illumination} size={48} />
            <div className="min-w-0">
              <div className="text-[13px] leading-tight font-semibold">{MOON_NAMES[moon.phase][de(lang) ? 0 : 1]}</div>
              <div className="text-[11px] text-text-2 tabular">{Math.round(moon.illumination * 100)} % · {de(lang) ? "Tag" : "day"} {moon.ageDays.toFixed(1)}</div>
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-gradient-to-r from-[#32e07a]/15 via-[#4fd8f0]/12 to-[#b16cff]/15 p-3">
            <div className="flex items-baseline justify-between">
              <div className="text-[12px] text-text-2">{de(lang) ? "Polarlicht-Chance (Kp)" : "Aurora chance (Kp)"}</div>
              <div className="text-[20px] font-bold tabular">{kp != null ? kp.toFixed(1) : "–"}</div>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-gradient-to-r from-[#32e07a] via-[#ffd60a] to-[#ff4d5e]" style={{ width: `${Math.min(100, ((kp ?? 0) / 9) * 100)}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] text-text-2">
              {kp != null
                ? de(lang)
                  ? `Faustregel: sichtbar ab ca. ${Math.round(66 - 2 * kp)}° geomagnetischer Breite (Norddeutschland ≈ 52°, Alpen ≈ 47°).`
                  : `Rule of thumb: visible from about ${Math.round(66 - 2 * kp)}° geomagnetic latitude (N. Germany ≈ 52°, Alps ≈ 47°).`
                : ""}
            </div>
          </div>
        </div>
      )}
      <DataMeta env={sw.data} className="px-4 pb-3" />
    </Card>
  );
}

// ---------------------------------------------------------------- Air quality

const AQ_STYLE = ["bg-green", "bg-teal", "bg-yellow", "bg-orange", "bg-red", "bg-purple"];
const AQ_LABEL = {
  de: ["Gut", "Ordentlich", "Mäßig", "Schlecht", "Sehr schlecht", "Extrem schlecht"],
  en: ["Good", "Fair", "Moderate", "Poor", "Very poor", "Extremely poor"],
};

export function AirQualityRow({ lat, lon }: { lat: number; lon: number }) {
  const { lang } = useT();
  const q = useProvider<AirQuality>("air-quality", { lat, lon });
  const a = q.data?.data;
  if (!a || a.europeanAqi == null) return null;
  const v = a.europeanAqi;
  const band = v <= 20 ? 0 : v <= 40 ? 1 : v <= 60 ? 2 : v <= 80 ? 3 : v <= 100 ? 4 : 5;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <Wind size={18} className="shrink-0 text-text-2" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-text-2">{de(lang) ? "Luftqualität (EAQI, modelliert)" : "Air quality (EAQI, modelled)"}</div>
        <div className="text-[14px] font-semibold">
          {v} · {AQ_LABEL[de(lang) ? "de" : "en"][band]}
        </div>
      </div>
      <div className="text-right text-[11px] text-text-2 tabular">
        PM2.5 {a.pm25 ?? "–"} · PM10 {a.pm10 ?? "–"}
        <br />O₃ {a.ozone ?? "–"} · NO₂ {a.no2 ?? "–"} µg/m³
      </div>
      <span className={cn("h-8 w-1.5 shrink-0 rounded-full", AQ_STYLE[band])} aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------- Earth from space (NASA EPIC)

export function EarthWidget() {
  const { lang } = useT();
  const q = useProvider<EpicImage[]>("epic");
  const imgs = q.data?.data ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const cur = imgs[sel ?? imgs.length - 1];
  return (
    <Card>
      <CardHeader title={de(lang) ? "Die Erde, gerade fotografiert" : "Earth, freshly photographed"} icon={<Orbit size={18} />} subtitle={de(lang) ? "NASA EPIC · 1,5 Mio. km entfernt (L1)" : "NASA EPIC · 1.5 million km away (L1)"} />
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : cur ? (
        <>
          <div className="relative mx-4 overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote NASA archive image, no optimizer on a static PWA */}
            <img src={cur.image} alt={de(lang) ? `Erde am ${new Date(cur.time).toLocaleString("de-DE")}` : `Earth on ${new Date(cur.time).toUTCString()}`} className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-[12px] text-white">
              {new Date(cur.time).toLocaleString(lang === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC · {de(lang) ? "Bildmitte" : "Centre"} {cur.centroid.lat.toFixed(0)}°, {cur.centroid.lon.toFixed(0)}°
            </div>
          </div>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {imgs.map((im, i) => (
              <button key={im.id} onClick={() => setSel(i)} aria-label={new Date(im.time).toUTCString()} className={cn("shrink-0 overflow-hidden rounded-lg ring-2", (sel ?? imgs.length - 1) === i ? "ring-accent" : "ring-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
                <img src={im.thumb} alt="" className="h-11 w-11 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      ) : (
        <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} compact />
      )}
      <DataMeta env={q.data} className="px-4 pt-1 pb-3" />
    </Card>
  );
}

// ---------------------------------------------------------------- On this day

export function HistoryWidget() {
  const { lang } = useT();
  const mounted = useMounted();
  const d = new Date();
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const q = useProvider<HistoryEvent[]>("on-this-day", { lang, md }, { enabled: mounted });
  const items = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader title={de(lang) ? "Heute in der Geschichte" : "On this day"} icon={<History size={18} />} subtitle={mounted ? d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long" }) : ""} />
      {!mounted || q.isPending ? (
        <ListSkeleton />
      ) : q.data?.data ? (
        items.length ? (
          <Divided>
            {items.slice(0, 5).map((e) => (
              <a key={`${e.year}-${e.title}`} href={e.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-2.5 active:bg-surface-2">
                <span className="w-12 shrink-0 text-[15px] font-bold text-accent tabular">{e.year}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug">{e.text}</span>
                {e.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnail
                  <img src={e.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                )}
              </a>
            ))}
          </Divided>
        ) : (
          <Empty />
        )
      ) : (
        <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} compact />
      )}
      <DataMeta env={q.data} className="px-4 pt-1 pb-3" />
    </Card>
  );
}
