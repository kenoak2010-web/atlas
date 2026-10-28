"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { Activity, Bell, Clock, Maximize2, Newspaper, Plane, TrendingUp, Tv } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import { usePrefs } from "@/lib/store";
import { useDark } from "@/lib/use-dark";
import { CHANNELS } from "@/lib/channels";
import { formatNumber, formatPct } from "@/lib/format";
import type { Quote } from "@/server/providers/markets";
import { useNews, NewsRow } from "../news";
import { EventRow } from "../events";
import { useTimeline, TimelineList } from "../timeline";
import { useMapData, type MapFilters } from "../map/use-map-data";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, cn } from "../ui";

const AtlasMap = dynamic(() => import("../map/atlas-map"), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });

export function BriefWidget() {
  const { t } = useT();
  const q = useNews();
  return (
    <Card>
      <CardHeader title={t("widget.brief")} icon={<Newspaper size={18} />} href="/news" subtitle={t("overview.briefNote")} />
      {q.isPending ? (
        <ListSkeleton rows={4} />
      ) : q.data?.data ? (
        <Divided>
          {q.clusters.slice(0, 6).map((c) => (
            <NewsRow key={c.id} c={c} compact />
          ))}
        </Divided>
      ) : (
        <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />
      )}
      <DataMeta env={q.data} className="px-4 pt-1 pb-3" />
    </Card>
  );
}

const MINI_FILTERS: MapFilters = { minMag: "4.5", range: "day", maxAgeH: 24, bbox: null, zoom: 0 };

export function MiniMapWidget() {
  const { t } = useT();
  const dark = useDark();
  const layers = usePrefs((s) => s.mapLayers);
  const visible = layers.filter((l) => l !== "aircraft");
  const { data } = useMapData(visible, MINI_FILTERS);
  return (
    <Card>
      <CardHeader title={t("widget.map")} href="/map" action={<Link href="/map" aria-label={t("widget.map")} className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-accent"><Maximize2 size={15} /></Link>} />
      <div className="h-[220px] w-full">
        <AtlasMap data={data} visible={visible} dark={dark} initial={{ center: [15, 20], zoom: 0.4 }} />
      </div>
    </Card>
  );
}

export function QuakesWidget() {
  const { t } = useT();
  const q = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  return (
    <Card>
      <CardHeader title={t("widget.quakes")} icon={<Activity size={18} />} href="/explore/hazards" subtitle="M ≥ 4.5 · 24 h" />
      {q.isPending ? <ListSkeleton /> : q.data?.data ? (
        q.data.data.length ? (
          <Divided>{q.data.data.slice(0, 5).map((e) => <EventRow key={e.id} e={e} />)}</Divided>
        ) : <Empty />
      ) : <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />}
      <DataMeta env={q.data} className="px-4 pt-1 pb-3" />
    </Card>
  );
}

export function AlertsWidget() {
  const { t } = useT();
  const de = useProvider<AtlasEvent[]>("alerts-de");
  const us = useProvider<AtlasEvent[]>("alerts-us");
  const gd = useProvider<AtlasEvent[]>("gdacs");
  const items = useMemo(
    () =>
      [...(gd.data?.data ?? []).filter((e) => e.severity >= 3), ...(de.data?.data ?? []).filter((e) => e.severity >= 3), ...(us.data?.data ?? []).filter((e) => e.severity >= 4)]
        .sort((a, b) => b.severity - a.severity || (b.updatedAt ?? b.time).localeCompare(a.updatedAt ?? a.time))
        .slice(0, 6),
    [de.data, us.data, gd.data],
  );
  const pending = de.isPending && us.isPending && gd.isPending;
  return (
    <Card>
      <CardHeader title={t("widget.alerts")} icon={<Bell size={18} />} href="/explore/hazards" subtitle={t("weather.alertsCoverage")} />
      {pending ? <ListSkeleton /> : items.length ? <Divided>{items.map((e) => <EventRow key={e.id} e={e} showCategory />)}</Divided> : <Empty />}
      <div className="space-y-1 px-4 pt-1 pb-3">
        <DataMeta env={gd.data} />
        <DataMeta env={de.data} />
        <DataMeta env={us.data} />
      </div>
    </Card>
  );
}

export function AviationWidget() {
  const { t } = useT();
  const q = useNews();
  const items = q.clusters.filter((c) => c.topics.includes("aviation")).slice(0, 4);
  return (
    <Card>
      <CardHeader title={t("widget.aviation")} icon={<Plane size={18} />} href="/explore/aviation" />
      {q.isPending ? <ListSkeleton /> : items.length ? <Divided>{items.map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
      <div className="px-4 pb-3">
        <Link href="/explore/aviation" className="text-[13px] font-medium text-accent">{t("aviation.liveAircraft")} →</Link>
      </div>
    </Card>
  );
}

export function QuoteTile({ q }: { q: Quote }) {
  const { lang } = useT();
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="truncate text-[12px] text-text-2">{q.label}</div>
      <div className="text-[17px] font-semibold tabular">{formatNumber(q.price, lang, q.group === "fx" ? 4 : 2)}</div>
      <div className={cn("text-[12px] font-medium tabular", q.changePct == null ? "text-text-3" : up ? "text-green" : "text-red")}>{formatPct(q.changePct, lang)}</div>
      <div className="truncate text-[10px] text-text-3">{q.delayNote}</div>
    </div>
  );
}

export function MarketsWidget() {
  const { t } = useT();
  const idx = useProvider<{ quotes: Quote[] }>("markets");
  const crypto = useProvider<Quote[]>("crypto");
  const fx = useProvider<{ quotes: Quote[] }>("fx");
  const quotes = [...(idx.data?.data?.quotes ?? []).slice(0, 4), ...(crypto.data?.data ?? []), ...(fx.data?.data?.quotes ?? []).slice(0, 2)];
  const pending = idx.isPending && crypto.isPending && fx.isPending;
  return (
    <Card>
      <CardHeader title={t("widget.markets")} icon={<TrendingUp size={18} />} href="/explore/economy" />
      {pending ? <ListSkeleton /> : quotes.length ? (
        <div className="grid grid-cols-2 gap-2 px-4 pb-2 sm:grid-cols-4">{quotes.map((q) => <QuoteTile key={q.id} q={q} />)}</div>
      ) : <ErrorState message={[idx.data?.error, crypto.data?.error, fx.data?.error].filter(Boolean).join(" · ")} />}
      <div className="space-y-1 px-4 pb-3">
        <DataMeta env={idx.data} />
        <DataMeta env={crypto.data} />
        <DataMeta env={fx.data} />
      </div>
    </Card>
  );
}

export function TvWidget() {
  const { t } = useT();
  const fav = usePrefs((s) => s.favoriteChannels);
  const list = (fav.length ? CHANNELS.filter((c) => fav.includes(c.id)) : CHANNELS.filter((c) => c.mode === "youtube")).slice(0, 6);
  return (
    <Card>
      <CardHeader title={t("widget.tv")} icon={<Tv size={18} />} href="/tv" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        {list.map((c) => (
          <Link key={c.id} href={`/tv?c=${c.id}`} className="flex h-16 w-32 shrink-0 flex-col justify-between rounded-xl bg-surface-2 p-2.5">
            <span className="text-[13px] leading-tight font-semibold">{c.name}</span>
            <span className="text-[10px] text-text-2 uppercase">{c.lang} · {c.mode === "youtube" ? "YouTube" : "Link"}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function TimelineWidget() {
  const { t } = useT();
  const { items, pending } = useTimeline({ categories: [], regions: [], maxAgeH: 24 });
  return (
    <Card>
      <CardHeader title={t("widget.timeline")} icon={<Clock size={18} />} href="/timeline" subtitle={t("time.24h")} />
      {pending && !items.length ? <ListSkeleton /> : items.length ? <TimelineList items={items} limit={8} /> : <Empty />}
      <div className="pb-2" />
    </Card>
  );
}
