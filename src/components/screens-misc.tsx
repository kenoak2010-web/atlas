"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Bookmark, BookmarkX, ChevronRight, Clock3, CloudLightning, Globe2, MapPin, Newspaper, Search, Siren, TrendingUp, Trash2, Waves, X } from "lucide-react";
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
import { AnimatedNumber, Card, CardHeader, Chip, ChipRow, DataMeta, Divided, Empty, ListSkeleton, RelTime, Segmented, SeverityDot, cn } from "./ui";
import { useHotspots } from "./widgets/intel-widgets";

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
        className="w-full"
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
      {items.length > 0 && <CategoryBar items={items} />}
      <Card>
        {pending && !items.length ? <ListSkeleton rows={6} /> : items.length ? <TimelineList items={items.slice(0, limit)} /> : <Empty icon={<Clock3 size={22} />} />}
        {items.length > limit && (
          <button onClick={() => setLimit(limit + 60)} className="w-full border-t hairline py-2.5 text-[14px] font-medium text-accent">{t("common.more")} ({items.length - limit})</button>
        )}
        {failed.length > 0 && <div className="px-4 pb-3 text-[11px] text-text-3">{t("fresh.unavailable")}: {failed.join(" · ")}</div>}
      </Card>
    </SubPage>
  );
}

const CAT_COLOR: Record<string, string> = { news: "#0a84ff", earthquake: "#ff9f0a", disaster: "#ff453a", "weather-alert": "#ffd60a", wildfire: "#ff6b35", volcano: "#bf5af2", humanitarian: "#30d158" };

/** Stacked bar showing how the visible timeline splits across categories. */
function CategoryBar({ items }: { items: { category: string }[] }) {
  const { t, lang } = useT();
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="card px-4 py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <AnimatedNumber value={items.length} className="text-[26px] font-bold" />
        <span className="text-[13px] text-text-2">{lang === "de" ? "Einträge im Zeitraum" : "entries in range"}</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {rows.map(([c, n]) => (
          <span key={c} className="h-full rounded-full transition-[flex-grow] duration-700 ease-[var(--ease-out)]" style={{ flexGrow: n, background: CAT_COLOR[c] ?? "var(--text-3)" }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-2">
        {rows.map(([c, n]) => (
          <span key={c} className="inline-flex items-center gap-1 tabular">
            <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] ?? "var(--text-3)" }} />
            {t(`cat.${c}` as TKey)} {n}
          </span>
        ))}
      </div>
    </div>
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
  const spots = useHotspots().slice(0, 6);
  return (
    <SubPage title={t("explore.search")}>
      <div className="card flex h-12 items-center gap-2 rounded-2xl px-3 transition-shadow duration-300 focus-within:shadow-[0_0_0_2px_var(--accent),0_10px_30px_-12px_var(--accent)]">
        <Search size={18} className="shrink-0 text-text-2" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-3" enterKeyHint="search" onKeyDown={(e) => e.key === "Enter" && s.length >= 3 && setWorldwide(q.trim())} />
        {q && (
          <button onClick={() => { setQ(""); setWorldwide(null); }} className="pop grid h-6 w-6 place-items-center rounded-full bg-text-3/40 text-surface-solid" aria-label={t("common.close")}>
            <X size={14} strokeWidth={3} />
          </button>
        )}
        {s.length >= 2 && (
          <button onClick={() => toggleSaved("savedSearches", q.trim())} aria-label={t("search.saveSearch")} className={cn("press p-1 transition-colors", saved.includes(q.trim()) ? "text-yellow" : "text-text-3")}>
            <Bookmark key={String(saved.includes(q.trim()))} size={18} fill={saved.includes(q.trim()) ? "currentColor" : "none"} className={saved.includes(q.trim()) ? "pop" : undefined} />
          </button>
        )}
      </div>
      {!s && (
        <div className="fade-in space-y-4">
          {saved.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-text-2"><Bookmark size={13} /> {t("search.saved")}</div>
              <ChipRow>{saved.map((x) => <Chip key={x} onClick={() => setQ(x)}>{x}</Chip>)}</ChipRow>
            </div>
          )}
          {spots.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-text-2"><TrendingUp size={13} /> {lang === "de" ? "Gerade im Fokus" : "In focus now"}</div>
              <ChipRow>{spots.map((x) => <Chip key={x.iso} onClick={() => setQ(lang === "de" ? x.country!.de : x.country!.en)}>{x.country!.flag} {lang === "de" ? x.country!.de : x.country!.en}</Chip>)}</ChipRow>
            </div>
          )}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-text-2"><Search size={13} /> {lang === "de" ? "Ideen" : "Ideas"}</div>
            <div className="grid grid-cols-2 gap-2">
              {(lang === "de"
                ? [{ q: "Erdbeben", i: <Waves size={16} /> }, { q: "Unwetter", i: <CloudLightning size={16} /> }, { q: "Wahl", i: <Newspaper size={16} /> }, { q: "Waldbrand", i: <Siren size={16} /> }]
                : [{ q: "Earthquake", i: <Waves size={16} /> }, { q: "Storm", i: <CloudLightning size={16} /> }, { q: "Election", i: <Newspaper size={16} /> }, { q: "Wildfire", i: <Siren size={16} /> }]
              ).map((x) => (
                <button key={x.q} onClick={() => setQ(x.q)} className="card press flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-[14px] font-medium">
                  <span className="bg-accent-gradient grid h-7 w-7 place-items-center rounded-lg text-white">{x.i}</span>
                  {x.q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {countries.length > 0 && (
        <Card>
          <CardHeader title={t("search.countries")} />
          <Divided>
            {countries.map((c) => (
              <Link key={c.iso2} href={`/country?c=${c.iso2}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-surface-2">
                <span className="text-[22px]">{c.flag}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{c.label}</div>
                  <div className="truncate text-[12px] text-text-2">{[c.capital, c.subregion].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="text-[12px] text-text-2 tabular">{news.clusters.filter((n) => n.countries.includes(c.iso2)).length} News</span>
                <ChevronRight size={16} className="text-text-3" />
              </Link>
            ))}
          </Divided>
          <div className="pb-2" />
        </Card>
      )}
      {s.length >= 2 && (
        <>
          <Card>
            <CardHeader title={`${t("search.news")} (${newsHits.length})`} />
            {newsHits.length ? <Divided>{newsHits.slice(0, 15).map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty icon={<Newspaper size={22} />} />}
            {s.length >= 3 && (
              <button onClick={() => setWorldwide(q.trim())} className="press flex w-full items-center justify-center gap-1.5 border-t hairline py-2.5 text-[14px] font-medium text-accent"><Globe2 size={15} /> {t("news.worldwideSearch")}</button>
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
            <CardHeader title={t("search.places")} icon={<MapPin size={18} />} subtitle="Photon / OpenStreetMap" />
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

const KIND_ICON: Record<string, React.ReactNode> = { quake: <Waves size={16} />, news: <Newspaper size={16} />, weather: <CloudLightning size={16} />, disaster: <Siren size={16} />, market: <TrendingUp size={16} />, region: <MapPin size={16} /> };
const KIND_BG: Record<string, string> = { quake: "bg-orange", news: "bg-red", weather: "bg-yellow", disaster: "bg-red", market: "bg-green", region: "bg-blue" };

export function AlertsScreen() {
  const { t, lang } = useT();
  const { items, markAllRead, markRead, clear } = useAlertStore();
  const unread = items.filter((i) => !i.read).length;
  const settings = usePrefs((s) => s.alerts);
  return (
    <SubPage
      title={t("alerts.title")}
      subtitle={t("alerts.inAppNote")}
      action={items.some((i) => !i.read) ? <button onClick={markAllRead} className="press fade-in text-[14px] font-medium text-accent">{t("alerts.markRead")}</button> : undefined}
    >
      {!settings.enabled && <div className="rounded-xl bg-orange/15 px-3 py-2 text-[13px] text-orange">{t("settings.alerts.enabled")}: off · <Link href="/settings#alerts" className="underline">{t("settings.title")}</Link></div>}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="card px-3 py-2.5">
            <AnimatedNumber value={items.length} className="block text-[24px] font-bold" />
            <div className="text-[11px] text-text-2">{lang === "de" ? "Hinweise gesamt" : "Total alerts"}</div>
          </div>
          <div className="card px-3 py-2.5">
            <AnimatedNumber value={unread} className={cn("block text-[24px] font-bold", unread > 0 && "text-accent")} />
            <div className="text-[11px] text-text-2">{lang === "de" ? "ungelesen" : "unread"}</div>
          </div>
        </div>
      )}
      <Card>
        {items.length ? (
          <Divided>
            {items.map((a) => (
              <a key={a.id} href={a.url ?? "#"} target={a.url ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => markRead(a.id)} className={cn("relative flex items-start gap-3 px-4 py-3 transition-colors duration-500 active:bg-surface-2", !a.read && "bg-accent/5")}>
                {!a.read && <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden />}
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-white", KIND_BG[a.kind] ?? "bg-text-3")} aria-hidden>{KIND_ICON[a.kind] ?? <Bell size={16} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-text-2">
                    <SeverityDot severity={a.severity} pulse={!a.read && a.severity >= 3} />
                    <RelTime iso={a.time} /> · {t(`alertKind.${a.kind}` as TKey)}
                  </div>
                  <div className={cn("text-[15px] leading-snug", !a.read && "font-semibold")}>{a.title}</div>
                  {a.body && <div className="text-[12px] text-text-2">{a.body}</div>}
                </div>
              </a>
            ))}
          </Divided>
        ) : (
          <Empty icon={<BellOff size={22} />}>{t("alerts.empty")}</Empty>
        )}
      </Card>
      {items.length > 0 && <button onClick={clear} className="press mx-auto flex min-h-[44px] items-center gap-1 text-[14px] text-red"><Trash2 size={15} /> {t("common.remove")}</button>}
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

const STATUS_DOT: Record<ProviderHealth["status"], string> = { ok: "bg-green", degraded: "bg-orange", down: "bg-red", idle: "bg-text-3", "not-configured": "bg-text-2" };

export function SourcesScreen() {
  const { t, lang } = useT();
  const [filter, setFilter] = useState<ProviderHealth["status"] | null>(null);
  const q = useQuery({
    queryKey: ["status"],
    queryFn: async () => (await (await fetch("/api/status")).json()) as { time: string; providers: ProviderHealth[] },
    refetchInterval: 30_000,
  });
  const providers = q.data?.providers ?? [];
  const count = (st: ProviderHealth["status"]) => providers.filter((p) => p.status === st).length;
  const shown = filter ? providers.filter((p) => p.status === filter) : providers;
  return (
    <SubPage
      title={t("sources.title")}
      subtitle={lang === "de" ? "ATLAS zeigt nur Daten aus diesen öffentlich zugänglichen Quellen. „Noch nicht abgefragt“ bedeutet: seit dem Serverstart nicht benötigt." : "ATLAS only shows data from these publicly available sources. “Not queried yet” means: not needed since the server started."}
    >
      {q.isPending ? <ListSkeleton rows={8} /> : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {(["ok", "degraded", "down", "idle"] as const).map((st) => (
              <button key={st} onClick={() => setFilter(filter === st ? null : st)} aria-pressed={filter === st} className={cn("card press px-1 py-2.5 text-center transition-shadow duration-300", filter === st && "ring-2 ring-accent")}>
                <AnimatedNumber value={count(st)} className={cn("block text-[22px] font-bold", STATUS_STYLE[st])} />
                <div className="truncate text-[10px] text-text-2">{t(`sources.${st}` as TKey)}</div>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {shown.map((p) => (
              <Card key={p.id} as="article" className="rise-item px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{p.label}</div>
                    <a href={p.attribution.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent">{p.attribution.name}</a>
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[p.status])}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[p.status], p.status === "ok" && "ping text-green")} />
                    {t(`sources.${p.status}` as TKey)}
                  </span>
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
            {!shown.length && <Empty />}
          </div>
        </>
      )}
      <p className="text-[12px] text-text-3">
        {lang === "de" ? "Länderdaten: world-countries (ODbL). Basiskarte: OpenFreeMap © OpenMapTiles © OpenStreetMap; Offline-Karte: Natural Earth." : "Country data: world-countries (ODbL). Basemap: OpenFreeMap © OpenMapTiles © OpenStreetMap; offline map: Natural Earth."}
      </p>
    </SubPage>
  );
}

/* ------------------------------------------------------------------ Saved */

export function SavedScreen() {
  const { t, lang } = useT();
  const bookmarks = usePrefs((s) => s.bookmarks);
  const toggle = usePrefs((s) => s.toggleBookmark);
  const places = usePrefs((s) => s.places);
  const removePlace = usePrefs((s) => s.removePlace);
  const countries = usePrefs((s) => s.countries);
  return (
    <SubPage title={t("saved.title")}>
      <Card>
        <CardHeader title={t("saved.bookmarks")} icon={<Bookmark size={18} />} subtitle={bookmarks.length ? `${bookmarks.length}` : undefined} />
        {bookmarks.length ? (
          <Divided>
            {bookmarks.map((b) => (
              <div key={b.id} className="flex items-start gap-2 px-4 py-2.5">
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="press min-w-0 flex-1 rounded-lg">
                  <div className="text-[12px] text-text-2">{b.source} · <RelTime iso={b.time} /></div>
                  <div className="text-[15px] leading-snug">{b.title}</div>
                </a>
                <button onClick={() => toggle(b)} className="press grid h-8 w-8 place-items-center rounded-full text-text-3 active:text-red" aria-label={t("common.remove")}><Trash2 size={16} /></button>
              </div>
            ))}
          </Divided>
        ) : <Empty icon={<BookmarkX size={22} />}>{t("saved.empty")}</Empty>}
      </Card>
      <Card>
        <CardHeader title={t("settings.places")} icon={<MapPin size={18} />} />
        {places.length ? (
          <Divided>
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2.5 text-[15px]">
                <span className="bg-accent-gradient grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"><MapPin size={15} /></span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-text-2 tabular">{p.radiusKm} km</span>
                <button onClick={() => removePlace(p.id)} className="press grid h-8 w-8 place-items-center rounded-full text-text-3 active:text-red" aria-label={t("common.remove")}><Trash2 size={16} /></button>
              </div>
            ))}
          </Divided>
        ) : <Empty icon={<MapPin size={22} />}>{lang === "de" ? "Noch keine Orte. In den Einstellungen oder auf der Karte hinzufügen." : "No places yet. Add them in settings or on the map."}</Empty>}
      </Card>
      {countries.length > 0 && (
        <Card>
          <CardHeader title={t("settings.countries")} />
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {countries.map((c) => {
              const k = COUNTRY_BY_ISO2.get(c);
              return (
                <Link key={c} href={`/country?c=${c}`} className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium">
                  {k?.flag} {k ? (lang === "de" ? k.de : k.en) : c} <ChevronRight size={13} className="text-text-3" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </SubPage>
  );
}
