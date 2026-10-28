"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { useSelection } from "@/lib/selection";
import type { Aircraft } from "@/server/providers/aviation";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { Card, CardHeader, Chip, ChipRow, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Row } from "../ui";

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

export function AviationScreen() {
  const { t, lang } = useT();
  const [region, setRegion] = useState(REGIONS[0]);
  const [term, setTerm] = useState("");
  const q = useProvider<Aircraft[]>("aircraft", { bbox: region.bbox });
  const select = useSelection((s) => s.select);
  const news = useNews();
  const avNews = news.clusters.filter((c) => c.topics.includes("aviation")).slice(0, 8);
  const list = useMemo(() => {
    const s = term.trim().toUpperCase();
    const all = q.data?.data ?? [];
    return (s ? all.filter((a) => a.callsign?.toUpperCase().includes(s) || a.icao24.toUpperCase().includes(s)) : all.filter((a) => !a.onGround))
      .sort((a, b) => (a.callsign ?? "~").localeCompare(b.callsign ?? "~"));
  }, [q.data, term]);
  const airborne = (q.data?.data ?? []).filter((a) => !a.onGround).length;
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
          <div className="flex gap-6 px-4 pb-2">
            <div><div className="text-[28px] font-semibold tabular">{airborne}</div><div className="text-[12px] text-text-2">{lang === "de" ? "in der Luft" : "airborne"}</div></div>
            <div><div className="text-[28px] font-semibold tabular">{(q.data.data.length - airborne)}</div><div className="text-[12px] text-text-2">{t("aviation.onGround")}</div></div>
          </div>
        )}
        <div className="mx-4 mb-2 flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={16} className="text-text-2" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={`${t("aviation.callsign")} / ICAO24`} aria-label={t("aviation.callsign")} className="min-w-0 flex-1 bg-transparent text-[16px] uppercase outline-none placeholder:normal-case placeholder:text-text-3" autoCapitalize="characters" />
        </div>
        {q.isPending ? <ListSkeleton rows={5} /> : q.data?.data ? (
          list.length ? (
            <Divided>
              {list.slice(0, 60).map((a) => (
                <Row key={a.icao24} onClick={() => select({ type: "aircraft", aircraft: a, fetchedAt: q.data?.fetchedAt ?? null })}>
                  <span className="w-20 font-mono text-[14px] font-semibold">{a.callsign ?? "—"}</span>
                  <span className="flex-1 truncate text-[13px] text-text-2">{a.originCountry}</span>
                  <span className="text-right text-[13px] tabular">{a.altitude != null ? `${formatNumber(a.altitude * 3.28084 / 100, lang, 0)} FL` : "–"}</span>
                  <span className="w-20 text-right text-[13px] text-text-2 tabular">{a.velocity != null ? `${Math.round(a.velocity * 1.94384)} kn` : "–"}</span>
                </Row>
              ))}
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
