"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Navigation, Plane, Search } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { useSelection } from "@/lib/selection";
import { COUNTRIES } from "@/lib/news/geotag";
import type { Aircraft } from "@/server/providers/aviation";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { AnimatedNumber, Card, CardHeader, Chip, ChipRow, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Row, Segmented, cn } from "../ui";

/** Preset regions (lamin,lomin,lamax,lomax), each small enough for OpenSky's cheapest credit tier. */
const REGIONS = [
  { id: "de", name: "Deutschland", bbox: "47,5,55,16" },
  { id: "alps", name: "Alpen / CH / AT", bbox: "45,5,49,17" },
  { id: "uk", name: "UK & Irland", bbox: "50,-11,59,2" },
  { id: "benelux", name: "Benelux / Paris", bbox: "48,0,54,8" },
  { id: "useast", name: "USA Nordost", bbox: "38,-80,44,-70" },
  { id: "dxb", name: "Golfregion", bbox: "22,48,28,58" },
  { id: "jp", name: "Japan (Kantō)", bbox: "33,137,38,142" },
];

/** OpenSky reports English country names; a few differ from our country list. */
const NAME_FIX: Record<string, string> = { Turkey: "Türkiye", "Czech Republic": "Czechia", "Republic of Moldova": "Moldova", "Lao People's Democratic Republic": "Laos", "Syrian Arab Republic": "Syria", "Bolivia (Plurinational State of)": "Bolivia", "Venezuela (Bolivarian Republic of)": "Venezuela", "United Republic of Tanzania": "Tanzania", "Republic of Korea": "South Korea", "Russian Federation": "Russia", "Viet Nam": "Vietnam", "Iran, Islamic Republic of": "Iran", "Kingdom of the Netherlands": "Netherlands" };
const FLAG_BY_EN = new Map(COUNTRIES.map((c) => [c.en.toLowerCase(), c.flag]));
const flagFor = (name: string) => FLAG_BY_EN.get((NAME_FIX[name] ?? name).toLowerCase()) ?? "🏳️";

/** Altitude bands in feet for the distribution bar. */
const BANDS = [
  { max: 10000, color: "#64d2ff", de: "< FL100", en: "< FL100" },
  { max: 25000, color: "#0a84ff", de: "FL100–250", en: "FL100–250" },
  { max: 35000, color: "#5e5ce6", de: "FL250–350", en: "FL250–350" },
  { max: Infinity, color: "#bf5af2", de: "> FL350", en: "> FL350" },
];
const MAX_FT = 45000;

type Sort = "alt" | "speed" | "call";

export function AviationScreen() {
  const { t, lang } = useT();
  const [region, setRegion] = useState(REGIONS[0]);
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<Sort>("alt");
  const q = useProvider<Aircraft[]>("aircraft", { bbox: region.bbox });
  const select = useSelection((s) => s.select);
  const news = useNews();
  const avNews = news.clusters.filter((c) => c.topics.includes("aviation")).slice(0, 8);
  const list = useMemo(() => {
    const s = term.trim().toUpperCase();
    const all = q.data?.data ?? [];
    const base = s ? all.filter((a) => a.callsign?.toUpperCase().includes(s) || a.icao24.toUpperCase().includes(s)) : all.filter((a) => !a.onGround);
    const cmp: Record<Sort, (a: Aircraft, b: Aircraft) => number> = {
      alt: (a, b) => (b.altitude ?? -1) - (a.altitude ?? -1),
      speed: (a, b) => (b.velocity ?? -1) - (a.velocity ?? -1),
      call: (a, b) => (a.callsign ?? "~").localeCompare(b.callsign ?? "~"),
    };
    // Rows without a callsign carry little information, so they go last.
    return base.sort((a, b) => Number(!a.callsign) - Number(!b.callsign) || cmp[sort](a, b));
  }, [q.data, term, sort]);
  const stats = useMemo(() => {
    const all = q.data?.data ?? [];
    const air = all.filter((a) => !a.onGround);
    const ft = air.map((a) => (a.altitude ?? 0) * 3.28084);
    const bands = BANDS.map((b, i) => ft.filter((f) => f < b.max && (i === 0 || f >= BANDS[i - 1].max)).length);
    const climbing = air.filter((a) => (a.verticalRate ?? 0) > 1).length;
    const descending = air.filter((a) => (a.verticalRate ?? 0) < -1).length;
    const byCountry = new Map<string, number>();
    for (const a of air) byCountry.set(a.originCountry, (byCountry.get(a.originCountry) ?? 0) + 1);
    const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const fastest = air.reduce<Aircraft | null>((m, a) => ((a.velocity ?? 0) > (m?.velocity ?? 0) ? a : m), null);
    return { total: all.length, airborne: air.length, bands, climbing, descending, countries, fastest };
  }, [q.data]);
  return (
    <SubPage title={t("explore.aviation")} subtitle={t("aviation.coverage")}>
      <ChipRow>
        {REGIONS.map((r) => (
          <Chip key={r.id} active={r.id === region.id} onClick={() => setRegion(r)}>{r.name}</Chip>
        ))}
      </ChipRow>
      <Card>
        <CardHeader title={`${t("aviation.liveAircraft")} · ${region.name}`} />
        {q.data?.data && (
          <div className="space-y-3 px-4 pb-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { n: stats.airborne, l: lang === "de" ? "in der Luft" : "airborne", c: "text-accent" },
                { n: stats.total - stats.airborne, l: t("aviation.onGround"), c: "" },
                { n: stats.climbing, l: lang === "de" ? "steigend" : "climbing", c: "text-green" },
                { n: stats.descending, l: lang === "de" ? "sinkend" : "descending", c: "text-orange" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-surface-2 px-1 py-2 text-center">
                  <AnimatedNumber value={x.n} className={cn("block text-[20px] font-bold", x.c)} />
                  <div className="truncate text-[10px] text-text-2">{x.l}</div>
                </div>
              ))}
            </div>
            {stats.airborne > 0 && (
              <div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
                  {stats.bands.map((n, i) => (
                    <span key={i} className="h-full transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${(n / stats.airborne) * 100}%`, background: BANDS[i].color }} />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-2">
                  {BANDS.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 tabular">
                      <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                      {lang === "de" ? b.de : b.en} · {stats.bands[i]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {stats.countries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stats.countries.map(([name, n]) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px]">
                    <span aria-hidden>{flagFor(name)}</span> {name} <b className="tabular">{n}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mx-4 mb-2 flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={16} className="text-text-2" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={`${t("aviation.callsign")} / ICAO24`} aria-label={t("aviation.callsign")} className="min-w-0 flex-1 bg-transparent text-[16px] uppercase outline-none placeholder:normal-case placeholder:text-text-3" autoCapitalize="characters" />
        </div>
        <div className="mx-4 mb-2">
          <Segmented<Sort> className="w-full" value={sort} onChange={setSort} label={lang === "de" ? "Sortierung" : "Sort"} options={[{ value: "alt", label: t("aviation.altitude") }, { value: "speed", label: lang === "de" ? "Tempo" : "Speed" }, { value: "call", label: t("aviation.callsign") }]} />
        </div>
        {q.isPending ? <ListSkeleton rows={5} /> : q.data?.data ? (
          list.length ? (
            <Divided>
              {list.slice(0, 60).map((a) => {
                const ft = (a.altitude ?? 0) * 3.28084;
                const vr = a.verticalRate ?? 0;
                return (
                  <Row key={a.icao24} onClick={() => select({ type: "aircraft", aircraft: a, fetchedAt: q.data?.fetchedAt ?? null })}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent" aria-hidden>
                      {a.heading != null ? <Navigation size={15} className="fill-current" style={{ transform: `rotate(${a.heading - 45}deg)` }} /> : <Plane size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("font-mono text-[14px] font-semibold", !a.callsign && "text-text-3")}>{a.callsign ?? a.icao24.toUpperCase()}</span>
                        {vr > 1 && <ArrowUpRight size={14} className="text-green" aria-label={lang === "de" ? "steigend" : "climbing"} />}
                        {vr < -1 && <ArrowDownRight size={14} className="text-orange" aria-label={lang === "de" ? "sinkend" : "descending"} />}
                      </span>
                      <span className="block truncate text-[12px] text-text-2"><span aria-hidden>{flagFor(a.originCountry)}</span> {a.originCountry}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="bg-accent-gradient block h-full rounded-full" style={{ width: `${Math.min(100, (ft / MAX_FT) * 100)}%` }} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular">
                      <span className="block text-[14px] font-semibold">{a.altitude != null ? `FL${formatNumber(ft / 100, lang, 0).padStart(3, "0")}` : "–"}</span>
                      <span className="block text-[12px] text-text-2">{a.velocity != null ? `${Math.round(a.velocity * 1.94384)} kn` : "–"}</span>
                    </span>
                  </Row>
                );
              })}
            </Divided>
          ) : <Empty />
        ) : <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />}
        {list.length > 60 && <div className="px-4 py-2 text-[12px] text-text-3">+{list.length - 60}</div>}
        <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
      </Card>
      <Card>
        <CardHeader title={t("aviation.news")} />
        {news.isPending ? <ListSkeleton /> : avNews.length ? <Divided>{avNews.map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
        <div className="pb-2" />
      </Card>
      <p className="px-1 text-[12px] text-text-3">{t("aviation.schedulesUnavailable")}</p>
    </SubPage>
  );
}
