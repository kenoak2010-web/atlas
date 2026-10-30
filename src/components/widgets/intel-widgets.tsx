"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, Crosshair, ScrollText } from "lucide-react";
import { useProvider } from "@/lib/api";
import { buildBriefing } from "@/lib/briefing";
import { countryAt, useCountryShapes } from "@/lib/country-shapes";
import { useT } from "@/lib/i18n";
import { COUNTRY_BY_ISO2 } from "@/lib/news/geotag";
import type { AtlasEvent } from "@/lib/types";
import type { Quote } from "@/server/providers/markets";
import type { SpaceWeather } from "@/server/providers/space";
import { useNews } from "../news";
import { Card, CardHeader, ListSkeleton, cn, useMounted } from "../ui";

const SEV_BORDER = ["border-l-text-3/40", "border-l-blue", "border-l-yellow", "border-l-orange", "border-l-red"];

export function BriefingWidget() {
  const { lang } = useT();
  const mounted = useMounted();
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const dwd = useProvider<AtlasEvent[]>("alerts-de");
  const sw = useProvider<SpaceWeather>("space-weather");
  const crypto = useProvider<Quote[]>("crypto");
  const markets = useProvider<{ quotes: Quote[] }>("markets");
  const news = useNews();
  const lines = useMemo(
    () =>
      buildBriefing(
        {
          quakes: quakes.data?.data ?? null,
          gdacs: gdacs.data?.data ?? null,
          news: news.data?.data ? news.clusters : null,
          dwd: dwd.data?.data ?? null,
          kp: sw.data?.data?.kp.at(-1)?.kp ?? null,
          crypto: crypto.data?.data?.map((q) => ({ id: q.id, label: q.label, changePct: q.changePct })) ?? null,
          indices: markets.data?.data?.quotes.filter((q) => q.group === "index").map((q) => ({ label: q.label, changePct: q.changePct })) ?? null,
        },
        lang,
      ),
    [quakes.data, gdacs.data, news.data, news.clusters, dwd.data, sw.data, crypto.data, markets.data, lang],
  );
  const loading = quakes.isPending && news.isPending;
  return (
    <Card>
      <CardHeader
        title={lang === "de" ? "Lagebriefing" : "Situation briefing"}
        icon={<ScrollText size={18} />}
        subtitle={
          <span suppressHydrationWarning>
            {lang === "de" ? "Automatisch aus Live-Daten zusammengestellt" : "Assembled automatically from live data"}
            {mounted && ` · ${new Date().toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        }
      />
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <ol className="space-y-2 px-4 pb-4">
          {lines.map((l, i) => {
            const body = (
              <>
                <span className="text-[16px] leading-none" aria-hidden>{l.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-[14px] leading-snug">{l.text}</span>
                  <span className="mt-0.5 block text-[11px] text-text-3">{l.source}</span>
                </span>
              </>
            );
            const cls = cn("flex gap-2.5 rounded-xl border-l-[3px] bg-surface-2 py-2 pr-3 pl-2.5", SEV_BORDER[l.severity] ?? SEV_BORDER[0]);
            return (
              <li key={i} className="rise-item">
                {l.href ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/** Countries with the most coverage and events right now. */
export function useHotspots() {
  const news = useNews();
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const shapes = useCountryShapes();
  return useMemo(() => {
    const score = new Map<string, { news: number; events: number }>();
    const bump = (iso: string, k: "news" | "events", n = 1) => {
      const s = score.get(iso) ?? { news: 0, events: 0 };
      s[k] += n;
      score.set(iso, s);
    };
    for (const c of news.clusters) if (c.countries[0]) bump(c.countries[0], "news", c.sourceCount);
    if (shapes.data) {
      for (const e of [...(quakes.data?.data ?? []), ...(gdacs.data?.data ?? []).filter((x) => x.severity >= 3)]) {
        if (!e.point) continue;
        const iso = countryAt(e.point.lat, e.point.lon, shapes.data);
        if (iso) bump(iso, "events", 2);
      }
    }
    return [...score.entries()]
      .map(([iso, s]) => ({ iso, ...s, total: s.news + s.events, country: COUNTRY_BY_ISO2.get(iso) }))
      .filter((x) => x.country)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [news.clusters, quakes.data, gdacs.data, shapes.data]);
}

export function HotspotsWidget() {
  const { lang } = useT();
  const spots = useHotspots();
  const max = spots[0]?.total ?? 1;
  return (
    <Card>
      <CardHeader
        title={lang === "de" ? "Brennpunkte" : "Hotspots"}
        icon={<Crosshair size={18} />}
        subtitle={lang === "de" ? "Länder nach Berichterstattung (Quellen) und Ereignissen" : "Countries by coverage (sources) and events"}
      />
      {!spots.length ? (
        <ListSkeleton rows={3} />
      ) : (
        <ul className="px-2 pb-3">
          {spots.map((s, i) => (
            <li key={s.iso}>
              <Link href={`/country?c=${s.iso}`} className="flex items-center gap-3 rounded-xl px-2 py-2 active:bg-surface-2">
                <span className="w-5 text-right text-[12px] font-bold text-text-3 tabular">{i + 1}</span>
                <span className="text-[22px] leading-none" aria-hidden>{s.country!.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{lang === "de" ? s.country!.de : s.country!.en}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="bg-accent-gradient block h-full rounded-full" style={{ width: `${(s.total / max) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right text-[11px] leading-tight text-text-2 tabular">
                  {s.news} {lang === "de" ? "Quellen" : "sources"}
                  <br />
                  {s.events / 2} {lang === "de" ? "Ereign." : "events"}
                </span>
                <ChevronRight size={16} className="text-text-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
