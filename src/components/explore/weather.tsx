"use client";

import { LocateFixed, Star } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/store";
import { weatherIcon } from "@/lib/weather-codes";
import type { CityWeather, WeatherForecast } from "@/server/providers/openmeteo";
import type { AtlasEvent } from "@/lib/types";
import { PlaceSearch } from "../place-search";
import { SubPage } from "../sub-page";
import { useWeatherLocation, WeatherDaily, WeatherSummary } from "../widgets/weather";
import { Card, CardHeader, Chip, ChipRow, DataMeta, ErrorState, ListSkeleton } from "../ui";
import { EventListCard } from "./hazards";

export function WeatherScreen() {
  const { t, lang } = useT();
  const { loc, locate, setLoc, geoError } = useWeatherLocation();
  const places = usePrefs((s) => s.places);
  const addPlace = usePrefs((s) => s.addPlace);
  const homeId = usePrefs((s) => s.homePlaceId);
  const set = usePrefs((s) => s.set);
  const q = useProvider<WeatherForecast>("weather", { lat: loc.lat, lon: loc.lon });
  const cities = useProvider<CityWeather[]>("world-weather");
  const de = useProvider<AtlasEvent[]>("alerts-de");
  const saved = places.find((p) => Math.abs(p.lat - loc.lat) < 0.01 && Math.abs(p.lon - loc.lon) < 0.01);
  return (
    <SubPage title={t("explore.weather")} subtitle={t("weather.locationHint")}>
      <PlaceSearch onPick={(p) => setLoc({ name: p.name, lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 })} />
      <ChipRow>
        <Chip onClick={() => locate(t("time.local"))}><LocateFixed size={14} /> {t("weather.useLocation")}</Chip>
        {places.map((p) => (
          <Chip key={p.id} active={p.id === homeId} onClick={() => setLoc({ name: p.name, lat: p.lat, lon: p.lon })}>{p.name}</Chip>
        ))}
      </ChipRow>
      {geoError && <div className="text-[12px] text-red">{geoError}</div>}
      <Card>
        <CardHeader
          title={loc.name}
          subtitle={`${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`}
          action={
            <button
              onClick={() => {
                if (saved) set("homePlaceId", saved.id);
                else addPlace({ name: loc.name, lat: loc.lat, lon: loc.lon, radiusKm: 300 });
              }}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-surface-2 px-3 text-[12px] font-medium text-accent"
            >
              <Star size={13} fill={saved && saved.id === homeId ? "currentColor" : "none"} /> {saved ? (lang === "de" ? "Als Standard" : "Set default") : t("common.save")}
            </button>
          }
        />
        {q.isPending ? <ListSkeleton rows={3} /> : q.data?.data ? (
          <>
            <WeatherSummary wx={q.data.data} />
            <div className="mt-3 border-t hairline">
              <div className="px-4 pt-3 text-[13px] font-semibold text-text-2">{t("weather.7days")}</div>
              <WeatherDaily wx={q.data.data} />
            </div>
          </>
        ) : <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />}
        <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
      </Card>
      <EventListCard title={t("hazards.warningsDe")} q={de} subtitle={t("weather.alertsCoverage")} />
      <Card>
        <CardHeader title={lang === "de" ? "Weltwetter" : "World weather"} />
        {cities.data?.data ? (
          <ul className="grid grid-cols-2 gap-x-4 px-4 pb-2 text-[14px]">
            {cities.data.data.map((c) => (
              <li key={c.name}>
                <button className="flex w-full items-center gap-2 py-1.5 text-left" onClick={() => setLoc({ name: c.name, lat: c.lat, lon: c.lon })}>
                  <span aria-hidden>{weatherIcon(c.weatherCode)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-medium tabular">{c.temperature != null ? Math.round(c.temperature) : "–"}°</span>
                </button>
              </li>
            ))}
          </ul>
        ) : cities.isPending ? <ListSkeleton /> : <ErrorState message={cities.data?.error ?? ""} onRetry={() => cities.refetch()} />}
        <DataMeta env={cities.data} className="px-4 pb-3" />
      </Card>
    </SubPage>
  );
}
