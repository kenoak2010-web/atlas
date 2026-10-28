"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useProvider } from "@/lib/api";
import { useT, type TKey } from "@/lib/i18n";
import { useAlertStore } from "@/lib/alerts";
import { usePrefs } from "@/lib/store";
import { useSelection } from "@/lib/selection";
import type { Region } from "@/lib/news/types";
import type { AtlasEvent, ProviderHealth } from "@/lib/types";
import type { GdeltArticle } from "@/server/providers/news";
import { COUNTRY_BY_ISO2 } from "@/lib/news/geotag";
import { useNews, NewsRow } from "./news";
import { EventRow } from "./events";
import { useTimeline, TimelineList } from "./timeline";
import { matchCountries, PlaceSearch } from "./place-search";
import { SubPage } from "./sub-page";
import { Card, CardHeader, Chip, ChipRow, DataMeta, Divided, Empty, ListSkeleton, RelTime, Segmented, SeverityDot, cn } from "./ui";

/* ------------------------------------------------------------------ Timeline */

const CATS = ["news", "earthquake", "disaster", "weather-alert", "wildfire", "volcano", "humanitarian"];
const REGIONS: Region[] = ["europe", "americas", "asia", "africa", "oceania"];

export function TimelineScreen() {
  const { t } = useT();
  const [maxAgeH, setAge] = useState(24);
  const [cats, setCats] = useState<string[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const { items, pending, failed } = useTimeline({ categories: cats, regions, maxAgeH });
  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const [limit, setLimit] = useState(60);
  return (
    <SubPage title={t("timeline.title")} subtitle={t("timeline.rangeNote")}>
      <Segmented
        value={String(maxAgeH)}
        onChange={(v) => setAge(Number(v))}
        options={[
          { value: "1", label: t("time.1h") },
          { value: "6", label: t("time.6h") },
          { value: "24", label: t("time.24h") },
          { value: "168", label: t("time.7d") },
        ]}
      />
      <ChipRow>
        {CATS.map((c) => (
          <Chip key={c} active={cats.includes(c)} onClick={() => toggle(cats, c, setCats)}>{t(`cat.${c}` as TKey)}</Chip>
        ))}
      </ChipRow>
      <ChipRow>
        {REGIONS.map((r) => (
          <Chip key={r} active={regions.includes(r)} onClick={() => toggle(regions, r, setRegions)}>{t(`region.${r}` as TKey)}</Chip>
        ))}
      </ChipRow>
      <Card>
        {pending && !items.length ? <ListSkeleton rows={6} /> : items.length ? <TimelineList items={items.slice(0, limit)} /> : <Empty />}
        {items.length > limit && (
          <button onClick={() => setLimit(limit + 60)} className="w-full border-t hairline py-2.5 text-[14px] font-medium text-accent">{t("common.more")} ({items.length - limit})</button>
        )}
        {failed.length > 0 && <div className="px-4 pb-3 text-[11px] text-text-3">{t("fresh.unavailable")}: {failed.join(" · ")}</div>}
      </Card>
    </SubPage>
  );
}

/* ------------------------------------------------------------------ Search */

export function SearchScreen() {
  const { t, lang } = useT();
  const [q, setQ] = useState("");
  const [worldwide, setWorldwide] = useState<string | null>(null);
  const saved = usePrefs((s) => s.savedSearches);
  const toggleSaved = usePrefs((s) => s.toggleIn);
  const select = useSelection((s) => s.select);
  useEffect(() => {
    const init = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read deep link once
    if (init) setQ(init);
  }, []);
  const news = useNews();
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "2.5", range: "week" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const eonet = useProvider<AtlasEvent[]>("eonet");
  const de = useProvider<AtlasEvent[]>("alerts-de");
  const s = q.trim().toLowerCase();
  const countries = useMemo(() => matchCountries(q, lang), [q, lang]);
  const countryCodes = countries.map((c) => c.iso2);
  const ccKey = countryCodes.join();
  const newsHits = useMemo(
    () => (s.length < 2 ? [] : news.clusters.filter((c) => c.articles.some((a) => a.title.toLowerCase().includes(s)) || c.countries.some((k) => countryCodes.includes(k)) || c.topics.some((tp) => t(`topic.${tp}` as TKey).toLowerCase().startsWith(s)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [news.clusters, s, ccKey],
  );
  const eventHits = useMemo(() => {
    if (s.length < 2) return [];
    return [quakes, gdacs, eonet, de]
      .flatMap((x) => x.data?.data ?? [])
      .filter((e) => e.title.toLowerCase().includes(s) || e.locationName?.toLowerCase().includes(s) || (e.countryCode && countryCodes.includes(e.countryCode)))
      .slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quakes.data, gdacs.data, eonet.data, de.data, s, ccKey]);
  const gdelt = useProvider<GdeltArticle[]>("gdelt", { q: worldwide ?? "", timespan: "24h" }, { enabled: !!worldwide });
  return (
    <SubPage title={t("explore.search")}>
      <div className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 shadow-[var(--shadow)] dark:bg-surface-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-3" enterKeyHint="search" onKeyDown={(e) => e.key === "Enter" && s.length >= 3 && setWorldwide(q.trim())} />
        {s.length >= 2 && (
          <button onClick={() => toggleSaved("savedSearches", q.trim())} aria-label={t("search.saveSearch")} className={saved.includes(q.trim()) ? "text-yellow" : "text-text-3"}>
            <Bookmark size={18} fill={saved.includes(q.trim()) ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      {saved.length > 0 && !s && (
        <div>
          <div className="mb-1 text-[13px] font-semibold text-text-2">{t("search.saved")}</div>
          <ChipRow>{saved.map((x) => <Chip key={x} onClick={() => setQ(x)}>{x}</Chip>)}</ChipRow>
        </div>
      )}
      {countries.length > 0 && (
        <Card>
          <CardHeader title={t("search.countries")} />
          <Divided>
            {countries.map((c) => (
              <div key={c.iso2} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[22px]">{c.flag}</span>
                <div className="flex-1">
                  <div className="text-[15px] font-medium">{c.label}</div>
                  <div className="text-[12px] text-text-2">{[c.capital, c.subregion].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="text-[12px] text-text-2 tabular">{news.clusters.filter((n) => n.countries.includes(c.iso2)).length} News</span>
              </div>
            ))}
          </Divided>
          <div className="pb-2" />
        </Card>
      )}
      {s.length >= 2 && (
        <>
          <Card>
            <CardHeader title={`${t("search.news")} (${newsHits.length})`} />
            {newsHits.length ? <Divided>{newsHits.slice(0, 15).map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
            {s.length >= 3 && (
              <button onClick={() => setWorldwide(q.trim())} className="w-full border-t hairline py-2.5 text-[14px] font-medium text-accent">{t("news.worldwideSearch")}</button>
            )}
          </Card>
          {worldwide && (
            <Card>
              <CardHeader title={`${t("search.worldwide")} · „${worldwide}“`} />
              {gdelt.isPending ? <ListSkeleton /> : gdelt.data?.data?.length ? (
                <Divided>
                  {gdelt.data.data.slice(0, 20).map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5">
                      <div className="text-[12px] text-text-2">{a.domain} · <RelTime iso={a.seenAt} /></div>
                      <div className="text-[14px] leading-snug">{a.title}</div>
                    </a>
                  ))}
                </Divided>
              ) : <Empty>{gdelt.data?.error ?? undefined}</Empty>}
              <DataMeta env={gdelt.data} className="px-4 pt-1 pb-3" />
            </Card>
          )}
          <Card>
            <CardHeader title={`${t("search.events")} (${eventHits.length})`} />
            {eventHits.length ? <Divided>{eventHits.map((e) => <EventRow key={e.id} e={e} showCategory />)}</Divided> : <Empty />}
          </Card>
          <Card>
            <CardHeader title={t("search.places")} subtitle="Photon / OpenStreetMap" />
            <div className="px-4 pb-4">
              <PlaceSearch
                onPick={(p) =>
                  select({
                    type: "event",
                    event: { id: `place:${p.lat},${p.lon}`, category: "news", title: p.name, point: { lat: p.lat, lon: p.lon, precision: "exact" }, source: { name: "OpenStreetMap / Photon", url: "https://www.openstreetmap.org" }, time: new Date().toISOString(), severity: 0, url: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=10/${p.lat}/${p.lon}` },
                  })
                }
              />
            </div>
          </Card>
        </>
      )}
    </SubPage>
  );
}

/* ------------------------------------------------------------------ Alerts */

export function AlertsScreen() {
  const { t } = useT();
  const { items, markAllRead, markRead, clear } = useAlertStore();
  const settings = usePrefs((s) => s.alerts);
  return (
    <SubPage
      title={t("alerts.title")}
      subtitle={t("alerts.inAppNote")}
      action={items.some((i) => !i.read) ? <button onClick={markAllRead} className="text-[14px] font-medium text-accent">{t("alerts.markRead")}</button> : undefined}
    >
      {!settings.enabled && <div className="rounded-xl bg-orange/15 px-3 py-2 text-[13px] text-orange">{t("settings.alerts.enabled")}: off · <Link href="/settings#alerts" className="underline">{t("settings.title")}</Link></div>}
      <Card>
        {items.length ? (
          <Divided>
            {items.map((a) => (
              <a key={a.id} href={a.url ?? "#"} target={a.url ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => markRead(a.id)} className={cn("flex items-start gap-3 px-4 py-3", !a.read && "bg-accent/5")}>
                <SeverityDot severity={a.severity} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-text-2"><RelTime iso={a.time} /> · {t(`alertKind.${a.kind}` as TKey)}</div>
                  <div className={cn("text-[15px] leading-snug", !a.read && "font-semibold")}>{a.title}</div>
                  {a.body && <div className="text-[12px] text-text-2">{a.body}</div>}
                </div>
              </a>
            ))}
          </Divided>
        ) : (
          <Empty>{t("alerts.empty")}</Empty>
        )}
      </Card>
      {items.length > 0 && <button onClick={clear} className="mx-auto flex min-h-[44px] items-center gap-1 text-[14px] text-red"><Trash2 size={15} /> {t("common.remove")}</button>}
      <Link href="/settings#alerts" className="block text-center text-[14px] font-medium text-accent">{t("settings.alerts")} →</Link>
    </SubPage>
  );
}

/* ------------------------------------------------------------------ Sources */

const STATUS_STYLE: Record<ProviderHealth["status"], string> = {
  ok: "text-green",
  degraded: "text-orange",
  down: "text-red",
  idle: "text-text-3",
  "not-configured": "text-text-2",
};

export function SourcesScreen() {
  const { t } = useT();
  const q = useQuery({
    queryKey: ["status"],
    queryFn: async () => (await (await fetch("/api/status")).json()) as { time: string; providers: ProviderHealth[] },
    refetchInterval: 30_000,
  });
  return (
    <SubPage title={t("sources.title")} subtitle="ATLAS zeigt nur Daten aus diesen öffentlich zugänglichen Quellen. „Noch nicht abgefragt“ bedeutet: seit dem Serverstart nicht benötigt.">
      {q.isPending ? <ListSkeleton rows={8} /> : (
        <div className="space-y-2">
          {q.data?.providers.map((p) => (
            <Card key={p.id} as="article" className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{p.label}</div>
                  <a href={p.attribution.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent">{p.attribution.name}</a>
                </div>
                <span className={cn("shrink-0 text-[12px] font-semibold", STATUS_STYLE[p.status])}>{t(`sources.${p.status}` as TKey)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px] text-text-2">
                <dt>{t("settings.refresh")}</dt><dd>{p.refreshSeconds >= 3600 ? `${p.refreshSeconds / 3600} h` : p.refreshSeconds >= 60 ? `${p.refreshSeconds / 60} min` : `${p.refreshSeconds} s`}</dd>
                <dt>{t("sources.rateLimit")}</dt><dd>{p.rateLimit}</dd>
                {p.attribution.license && (<><dt>{t("sources.license")}</dt><dd>{p.attribution.license}</dd></>)}
                {p.requiresKey && (<><dt>Key</dt><dd className="font-mono">{p.requiresKey}</dd></>)}
                {p.lastSuccess && (<><dt>{t("sources.lastSuccess")}</dt><dd><RelTime iso={p.lastSuccess} /></dd></>)}
                {p.lastError && (<><dt>{t("sources.lastError")}</dt><dd className="text-red">{p.lastError}</dd></>)}
              </dl>
              {p.note && <p className="mt-1.5 text-[12px] text-text-3">{p.note}</p>}
            </Card>
          ))}
        </div>
      )}
      <p className="text-[12px] text-text-3">Länderdaten: world-countries (ODbL). Basiskarte: OpenFreeMap © OpenMapTiles © OpenStreetMap; Offline-Karte: Natural Earth.</p>
    </SubPage>
  );
}

/* ------------------------------------------------------------------ Saved */

export function SavedScreen() {
  const { t } = useT();
  const bookmarks = usePrefs((s) => s.bookmarks);
  const toggle = usePrefs((s) => s.toggleBookmark);
  const places = usePrefs((s) => s.places);
  const removePlace = usePrefs((s) => s.removePlace);
  const countries = usePrefs((s) => s.countries);
  return (
    <SubPage title={t("saved.title")}>
      <Card>
        <CardHeader title={t("saved.bookmarks")} />
        {bookmarks.length ? (
          <Divided>
            {bookmarks.map((b) => (
              <div key={b.id} className="flex items-start gap-2 px-4 py-2.5">
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                  <div className="text-[12px] text-text-2">{b.source} · <RelTime iso={b.time} /></div>
                  <div className="text-[15px] leading-snug">{b.title}</div>
                </a>
                <button onClick={() => toggle(b)} className="p-1 text-text-3" aria-label={t("common.remove")}><Trash2 size={16} /></button>
              </div>
            ))}
          </Divided>
        ) : <Empty>{t("saved.empty")}</Empty>}
      </Card>
      <Card>
        <CardHeader title={t("settings.places")} />
        {places.length ? (
          <Divided>
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2.5 text-[15px]">
                <span className="flex-1">{p.name}</span>
                <span className="text-[12px] text-text-2 tabular">{p.radiusKm} km</span>
                <button onClick={() => removePlace(p.id)} className="p-1 text-text-3" aria-label={t("common.remove")}><Trash2 size={16} /></button>
              </div>
            ))}
          </Divided>
        ) : <Empty>{t("saved.empty")}</Empty>}
      </Card>
      {countries.length > 0 && (
        <Card>
          <CardHeader title={t("settings.countries")} />
          <div className="flex flex-wrap gap-2 px-4 pb-4">{countries.map((c) => <span key={c} className="rounded-full bg-surface-2 px-3 py-1 text-[13px]">{COUNTRY_BY_ISO2.get(c)?.flag} {c}</span>)}</div>
        </Card>
      )}
    </SubPage>
  );
}
