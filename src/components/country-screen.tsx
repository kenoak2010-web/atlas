"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, CloudSun, Newspaper } from "lucide-react";
import { useProvider } from "@/lib/api";
import { countryAt, useCountryShapes } from "@/lib/country-shapes";
import { useT } from "@/lib/i18n";
import { COUNTRIES, COUNTRY_BY_ISO2 } from "@/lib/news/geotag";
import type { AtlasEvent } from "@/lib/types";
import type { WeatherForecast } from "@/server/providers/openmeteo";
import { EventRow } from "./events";
import { useNews, NewsHero, NewsRow } from "./news";
import { SubPage } from "./sub-page";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton } from "./ui";
import { WeatherSummary } from "./widgets/weather";
import { useHotspots } from "./widgets/intel-widgets";
import Link from "next/link";

export function CountryScreen() {
  const iso = useSearchParams().get("c")?.toUpperCase() ?? null;
  const country = iso ? COUNTRY_BY_ISO2.get(iso) : undefined;
  if (!iso || !country) return <CountryPicker />;
  return <Dossier iso={iso} />;
}

function CountryPicker() {
  const { lang } = useT();
  const spots = useHotspots();
  const [q, setQ] = useState("");
  const list = COUNTRIES.filter((c) => !q || `${c.de} ${c.en} ${c.iso2}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (lang === "de" ? a.de.localeCompare(b.de, "de") : a.en.localeCompare(b.en)));
  return (
    <SubPage title={lang === "de" ? "Länder" : "Countries"} subtitle={lang === "de" ? "Dossier mit News, Ereignissen und Wetter" : "Dossier with news, events and weather"}>
      {spots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {spots.map((s) => (
            <Link key={s.iso} href={`/country?c=${s.iso}`} className="card press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium">
              <span aria-hidden>{s.country!.flag}</span> {lang === "de" ? s.country!.de : s.country!.en}
            </Link>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={lang === "de" ? "Land suchen" : "Search country"}
        className="card h-11 w-full rounded-xl px-3 text-[16px] outline-none"
        aria-label={lang === "de" ? "Land suchen" : "Search country"}
      />
      <Card>
        <Divided>
          {list.map((c) => (
            <Link key={c.iso2} href={`/country?c=${c.iso2}`} className="flex min-h-[44px] items-center gap-3 px-4 py-2 active:bg-surface-2">
              <span className="text-[20px]" aria-hidden>{c.flag}</span>
              <span className="text-[15px]">{lang === "de" ? c.de : c.en}</span>
            </Link>
          ))}
        </Divided>
      </Card>
    </SubPage>
  );
}

function Dossier({ iso }: { iso: string }) {
  const { lang } = useT();
  const c = COUNTRY_BY_ISO2.get(iso)!;
  const name = lang === "de" ? c.de : c.en;
  const news = useNews();
  const shapes = useCountryShapes();
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "2.5", range: "week" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const eonet = useProvider<AtlasEvent[]>("eonet");
  const wx = useProvider<WeatherForecast>("weather", { lat: c.lat, lon: c.lon });

  const stories = useMemo(() => news.clusters.filter((n) => n.countries.includes(iso)), [news.clusters, iso]);
  const events = useMemo(() => {
    if (!shapes.data) return null;
    const inside = (e: AtlasEvent) => !!e.point && countryAt(e.point.lat, e.point.lon, shapes.data!) === iso;
    return [...(quakes.data?.data ?? []).filter(inside), ...(gdacs.data?.data ?? []).filter(inside), ...(eonet.data?.data ?? []).filter(inside)].sort((a, b) => b.severity - a.severity || b.time.localeCompare(a.time));
  }, [shapes.data, quakes.data, gdacs.data, eonet.data, iso]);

  const stats = [
    { n: stories.length, l: lang === "de" ? "Themen" : "Stories" },
    { n: stories.reduce((s, x) => s + x.sourceCount, 0), l: lang === "de" ? "Quellen" : "Sources" },
    { n: events?.filter((e) => e.category === "earthquake").length ?? "–", l: lang === "de" ? "Beben 7 T" : "Quakes 7d" },
    { n: events ? events.length - events.filter((e) => e.category === "earthquake").length : "–", l: lang === "de" ? "Ereignisse" : "Events" },
  ];

  return (
    <SubPage
      title={name}
      subtitle={[c.capital && `${lang === "de" ? "Hauptstadt" : "Capital"}: ${c.capital}`, c.subregion ?? c.region].filter(Boolean).join(" · ")}
      action={<span className="text-[52px] leading-none" aria-hidden>{c.flag}</span>}
    >
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.l} className="card px-2 py-2.5 text-center">
            <div className="text-[20px] font-bold tabular">{s.n}</div>
            <div className="truncate text-[10px] text-text-2">{s.l}</div>
          </div>
        ))}
      </div>

      {stories[0] && <NewsHero c={stories[0]} />}
      <Card>
        <CardHeader title={lang === "de" ? "Nachrichten" : "News"} icon={<Newspaper size={18} />} subtitle={lang === "de" ? "Meldungen, die das Land nennen" : "Stories that mention the country"} />
        {news.isPending ? <ListSkeleton /> : stories.length > 1 ? <Divided>{stories.slice(1, 12).map((s) => <NewsRow key={s.id} c={s} compact />)}</Divided> : stories.length ? null : <Empty />}
        <DataMeta env={news.data} className="px-4 pt-1 pb-3" />
      </Card>

      <Card>
        <CardHeader title={lang === "de" ? "Ereignisse im Land" : "Events in the country"} icon={<Activity size={18} />} subtitle={lang === "de" ? "Erdbeben (7 Tage, M2.5+), GDACS, NASA EONET – Zuordnung über Landesgrenzen (1:110m)" : "Quakes (7 days, M2.5+), GDACS, NASA EONET – matched by country outline (1:110m)"} />
        {events == null ? <ListSkeleton /> : events.length ? <Divided>{events.slice(0, 15).map((e) => <EventRow key={e.id} e={e} showCategory />)}</Divided> : <Empty />}
      </Card>

      <Card>
        <CardHeader title={lang === "de" ? "Wetter (Landesmitte)" : "Weather (country centre)"} icon={<CloudSun size={18} />} />
        {wx.isPending ? <ListSkeleton rows={2} /> : wx.data?.data ? <WeatherSummary wx={wx.data.data} compact /> : <ErrorState message={wx.data?.error ?? ""} onRetry={() => wx.refetch()} compact />}
        <DataMeta env={wx.data} className="px-4 pt-2 pb-3" />
      </Card>
    </SubPage>
  );
}
