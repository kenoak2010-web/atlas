"use client";

import { useMemo } from "react";
import { useProvider } from "@/lib/api";
import { buildTimeline, clusterToItem, eventToItem, type TimelineFilter, type TimelineItem } from "@/lib/timeline";
import type { AtlasEvent } from "@/lib/types";
import type { NewsPayload } from "@/lib/news/types";
import { useSelection } from "@/lib/selection";
import { useT, type TKey } from "@/lib/i18n";
import { RelTime, SeverityDot } from "./ui";

export function useTimeline(filter: TimelineFilter) {
  const range = filter.maxAgeH <= 1 ? "hour" : filter.maxAgeH <= 24 ? "day" : "week";
  const sources = {
    news: useProvider<NewsPayload>("news"),
    quakes: useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range }),
    gdacs: useProvider<AtlasEvent[]>("gdacs"),
    eonet: useProvider<AtlasEvent[]>("eonet"),
    de: useProvider<AtlasEvent[]>("alerts-de"),
    us: useProvider<AtlasEvent[]>("alerts-us"),
    volcano: useProvider<AtlasEvent[]>("volcanoes"),
    relief: useProvider<AtlasEvent[]>("humanitarian"),
  };
  const { news, quakes, gdacs, eonet, de, us, volcano, relief } = sources;
  const catKey = filter.categories.join();
  const regionKey = filter.regions.join();
  const items = useMemo(() => {
    const all: TimelineItem[] = [
      ...(news.data?.data?.clusters ?? []).filter((c) => c.sourceCount > 1 || c.breaking || c.score.severity >= 20).map(clusterToItem),
      ...[quakes, gdacs, eonet, de, us, volcano, relief].flatMap((q) => (q.data?.data ?? []).map(eventToItem)),
    ];
    return buildTimeline(all, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news.data, quakes.data, gdacs.data, eonet.data, de.data, us.data, volcano.data, relief.data, filter.maxAgeH, catKey, regionKey]);
  const pending = Object.values(sources).some((q) => q.isPending);
  const failed = Object.entries(sources)
    .filter(([, q]) => q.data && !q.data.data)
    .map(([k, q]) => `${k}: ${q.data?.error}`);
  return { items, pending, failed, sources };
}

export function TimelineList({ items, limit }: { items: TimelineItem[]; limit?: number }) {
  const select = useSelection((s) => s.select);
  const { t } = useT();
  const list = limit ? items.slice(0, limit) : items;
  return (
    <ol className="relative px-4 py-2">
      {list.map((i) => (
        <li key={i.id} className="relative flex gap-3 pb-3 last:pb-0">
          <div className="flex flex-col items-center pt-1.5">
            <SeverityDot severity={i.severity} className="h-2.5 w-2.5" />
            <span className="mt-1 w-px flex-1 bg-[var(--separator)]" aria-hidden />
          </div>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => (i.cluster ? select({ type: "news", cluster: i.cluster }) : i.event && select({ type: "event", event: i.event }))}
          >
            <div className="text-[11px] text-text-2">
              <RelTime iso={i.updatedAt} /> · {t(`cat.${i.category}` as TKey)} · {i.source}
            </div>
            <div className="text-[14px] leading-snug font-medium">{i.title}</div>
          </button>
        </li>
      ))}
    </ol>
  );
}
