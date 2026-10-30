"use client";

import { useMemo } from "react";
import { useProvider } from "@/lib/api";
import { buildTimeline, clusterToItem, eventToItem, type TimelineFilter, type TimelineItem } from "@/lib/timeline";
import type { AtlasEvent } from "@/lib/types";
import type { NewsPayload } from "@/lib/news/types";
import { useSelection } from "@/lib/selection";
import { useT, type TKey } from "@/lib/i18n";
import { RelTime, SeverityDot, useMounted, useNow } from "./ui";

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

function dayLabel(iso: string, lang: "de" | "en", now: number) {
  const d = new Date(iso);
  const key = (x: Date) => x.toDateString();
  if (key(d) === key(new Date(now))) return lang === "de" ? "Heute" : "Today";
  if (key(d) === key(new Date(now - 86_400_000))) return lang === "de" ? "Gestern" : "Yesterday";
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function TimelineList({ items, limit }: { items: TimelineItem[]; limit?: number }) {
  const select = useSelection((s) => s.select);
  const { t, lang } = useT();
  const mounted = useMounted();
  const now = useNow(60_000);
  const list = limit ? items.slice(0, limit) : items;
  // Day headers only on the full page; the overview widget stays compact.
  const groups: { day: string; items: TimelineItem[] }[] = [];
  for (const i of list) {
    const day = !limit && mounted ? dayLabel(i.updatedAt, lang, now) : "";
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(i);
  }
  return (
    <div className="py-2">
      {groups.map((g) => (
        <div key={g.day || "all"}>
          {g.day && <div className="sticky top-0 z-[1] bg-surface-solid/80 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-text-2 uppercase backdrop-blur-xl">{g.day}</div>}
          <ol className="stagger relative px-4 pt-1">
            {g.items.map((i) => (
              <li key={i.id} className="relative flex gap-3 pb-3 last:pb-1">
                {!limit && (
                  <span className="w-10 shrink-0 pt-0.5 text-right text-[11px] font-medium text-text-3 tabular" suppressHydrationWarning>
                    {mounted ? new Date(i.updatedAt).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                )}
                <div className="flex flex-col items-center pt-1.5">
                  <SeverityDot severity={i.severity} pulse={i.severity >= 3} className="h-2.5 w-2.5" />
                  <span className="mt-1 w-px flex-1 bg-gradient-to-b from-[var(--separator)] to-transparent" aria-hidden />
                </div>
                <button
                  className="press min-w-0 flex-1 rounded-lg text-left"
                  onClick={() => (i.cluster ? select({ type: "news", cluster: i.cluster }) : i.event && select({ type: "event", event: i.event }))}
                >
                  <div className="text-[11px] text-text-2">
                    {limit && <><RelTime iso={i.updatedAt} /> · </>}
                    {t(`cat.${i.category}` as TKey)} · {i.source}
                  </div>
                  <div className="text-[14px] leading-snug font-medium">{i.title}</div>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
