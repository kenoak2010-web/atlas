"use client";

import { useMemo, useState } from "react";
import { useProvider, type ClientEnvelope } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import type { FirePoint } from "@/server/providers/hazards";
import { EventRow } from "../events";
import { SubPage } from "../sub-page";
import { AnimatedNumber, Card, CardHeader, Chip, ChipRow, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Segmented, cn, useNow } from "../ui";

export function EventListCard({ title, q, limit = 8, subtitle, showCategory }: { title: string; q: { data?: ClientEnvelope<AtlasEvent[]>; isPending: boolean; error: Error | null; refetch: () => unknown }; limit?: number; subtitle?: string; showCategory?: boolean }) {
  const [all, setAll] = useState(false);
  const { t } = useT();
  const list = q.data?.data ?? [];
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle ?? q.data?.note} />
      {q.isPending ? (
        <ListSkeleton />
      ) : q.data?.data ? (
        list.length ? (
          <Divided>{(all ? list : list.slice(0, limit)).map((e) => <EventRow key={e.id} e={e} showCategory={showCategory} />)}</Divided>
        ) : (
          <Empty />
        )
      ) : (
        <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />
      )}
      {list.length > limit && (
        <button onClick={() => setAll(!all)} className="w-full border-t hairline py-2.5 text-[14px] font-medium text-accent">
          {all ? t("common.close") : `${t("common.showAll")} (${list.length})`}
        </button>
      )}
      <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
    </Card>
  );
}

const BINS = [
  { min: 2.5, max: 4, label: "2.5–4", color: "bg-[#6b7186]" },
  { min: 4, max: 5, label: "4–5", color: "bg-[#8e94a8]" },
  { min: 5, max: 6, label: "5–6", color: "bg-yellow" },
  { min: 6, max: 7, label: "6–7", color: "bg-orange" },
  { min: 7, max: 99, label: "7+", color: "bg-red" },
];

/** Magnitude distribution and timeline for the selected quake list. */
function QuakeStats({ quakes, range }: { quakes: AtlasEvent[]; range: "day" | "week" }) {
  const { lang } = useT();
  const now = useNow(60_000);
  const stats = useMemo(() => {
    const mags = quakes.map((q) => Number(q.meta?.magnitude ?? 0));
    const strongest = quakes[mags.indexOf(Math.max(...mags))];
    const depths = quakes.map((q) => Number(q.meta?.depthKm)).filter(Number.isFinite);
    const bins = BINS.map((b) => mags.filter((m) => m >= b.min && m < b.max).length);
    const slots = range === "day" ? 24 : 7;
    const slotMs = range === "day" ? 3_600_000 : 86_400_000;
    const timeline = Array.from({ length: slots }, () => 0);
    for (const q of quakes) {
      const i = slots - 1 - Math.floor((now - Date.parse(q.time)) / slotMs);
      if (i >= 0 && i < slots) timeline[i]++;
    }
    return { strongest, maxMag: Math.max(0, ...mags), avgDepth: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : null, bins, timeline };
  }, [quakes, range, now]);
  const maxBin = Math.max(1, ...stats.bins);
  const maxT = Math.max(1, ...stats.timeline);
  return (
    <Card>
      <div className="grid grid-cols-3 gap-2 px-4 pt-4">
        {[
          { v: quakes.length, d: 0, l: lang === "de" ? "Beben" : "Quakes" },
          { v: stats.maxMag || null, d: 1, l: lang === "de" ? "Stärkstes (M)" : "Strongest (M)" },
          { v: stats.avgDepth, d: 0, l: lang === "de" ? "Ø Tiefe (km)" : "Avg depth (km)" },
        ].map((x) => (
          <div key={x.l} className="rounded-2xl bg-surface-2 px-2 py-2.5 text-center">
            <AnimatedNumber value={x.v} decimals={x.d} className="block text-[22px] font-bold" />
            <div className="truncate text-[10px] text-text-2">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 pt-4 pb-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-text-2 uppercase">{lang === "de" ? "Magnituden" : "Magnitudes"}</div>
          <div className="flex h-20 items-end gap-1.5">
            {stats.bins.map((n, i) => (
              <div key={BINS[i].label} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
                <span className="text-[10px] font-semibold tabular">{n || ""}</span>
                <div className={cn("grow-y w-full rounded-t-md", BINS[i].color)} style={{ height: `${(n / maxBin) * 100}%`, minHeight: n ? 3 : 0, animationDelay: `${i * 60}ms` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-center text-[9px] text-text-3">
            {BINS.map((b) => <span key={b.label} className="flex-1">{b.label}</span>)}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-text-2 uppercase">{range === "day" ? (lang === "de" ? "Pro Stunde" : "Per hour") : lang === "de" ? "Pro Tag" : "Per day"}</div>
          <div className="flex h-20 items-end gap-[2px]">
            {stats.timeline.map((n, i) => (
              <div key={i} className="bg-accent-gradient grow-y flex-1 rounded-t-[3px]" style={{ height: `${(n / maxT) * 100}%`, minHeight: n ? 3 : 1, opacity: n ? 1 : 0.25, animationDelay: `${i * 15}ms` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-text-3">
            <span>{range === "day" ? "−24 h" : "−7 d"}</span>
            <span>{lang === "de" ? "jetzt" : "now"}</span>
          </div>
        </div>
      </div>
      {stats.strongest && (
        <div className="px-4 pb-4 text-[12px] text-text-2">
          {lang === "de" ? "Stärkstes Beben: " : "Strongest: "}
          <span className="font-semibold text-text">M{stats.maxMag.toFixed(1)} · {stats.strongest.locationName ?? stats.strongest.title}</span>
        </div>
      )}
    </Card>
  );
}

type Tab = "quakes" | "disasters" | "warnings" | "volcanoes" | "fires";

export function HazardsScreen() {
  const { t, lang } = useT();
  const [tab, setTab] = useState<Tab>("quakes");
  const [minMag, setMinMag] = useState<"2.5" | "4.5" | "significant">("4.5");
  const [range, setRange] = useState<"day" | "week">("day");
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag, range });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const eonet = useProvider<AtlasEvent[]>("eonet");
  const de = useProvider<AtlasEvent[]>("alerts-de");
  const us = useProvider<AtlasEvent[]>("alerts-us");
  const gvp = useProvider<AtlasEvent[]>("volcanoes");
  const hans = useProvider<AtlasEvent[]>("volcanoes-us");
  const firms = useProvider<FirePoint[]>("firms", { bbox: "-180,-90,180,90" });
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "quakes", label: t("hazards.quakes"), n: quakes.data?.data?.length },
    { id: "disasters", label: lang === "de" ? "Katastrophen" : "Disasters", n: (gdacs.data?.data?.length ?? 0) + (eonet.data?.data?.length ?? 0) || undefined },
    { id: "warnings", label: lang === "de" ? "Unwetter" : "Weather", n: (de.data?.data?.length ?? 0) + (us.data?.data?.length ?? 0) || undefined },
    { id: "volcanoes", label: lang === "de" ? "Vulkane" : "Volcanoes", n: (hans.data?.data?.length ?? 0) + (gvp.data?.data?.length ?? 0) || undefined },
    { id: "fires", label: lang === "de" ? "Feuer" : "Fires" },
  ];
  return (
    <SubPage title={t("explore.hazards")}>
      <ChipRow>
        {tabs.map((x) => (
          <Chip key={x.id} active={tab === x.id} onClick={() => setTab(x.id)}>
            {x.label}
            {x.n != null && <span className={cn("rounded-full px-1.5 text-[11px] tabular", tab === x.id ? "bg-white/25" : "bg-surface-2")}>{x.n}</span>}
          </Chip>
        ))}
      </ChipRow>
      <div key={tab} className="fade-in space-y-3">
        {tab === "quakes" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Segmented value={minMag} onChange={setMinMag} options={[{ value: "2.5", label: "M2.5+" }, { value: "4.5", label: "M4.5+" }, { value: "significant", label: "Sig." }]} />
              <Segmented value={range} onChange={setRange} options={[{ value: "day", label: t("time.24h") }, { value: "week", label: t("time.7d") }]} />
            </div>
            {quakes.data?.data && <QuakeStats quakes={quakes.data.data} range={range} />}
            <EventListCard title={t("hazards.quakes")} q={quakes} limit={12} />
          </>
        )}
        {tab === "disasters" && (
          <>
            <EventListCard title={t("hazards.gdacs")} q={gdacs} />
            <EventListCard title={t("hazards.eonet")} q={eonet} showCategory />
          </>
        )}
        {tab === "warnings" && (
          <>
            <EventListCard title={t("hazards.warningsDe")} q={de} />
            <EventListCard title={t("hazards.warningsUs")} q={us} />
          </>
        )}
        {tab === "volcanoes" && (
          <>
            <EventListCard title={`${t("hazards.volcanoes")} – USA`} q={hans} />
            <EventListCard title={t("hazards.volcanoes")} q={gvp} />
          </>
        )}
        {tab === "fires" && (
          <Card>
            <CardHeader title={t("hazards.fires")} subtitle={t("hazards.firesNote")} />
            {firms.data?.data ? (
              <div className="px-4 pb-2 text-[15px]">
                <AnimatedNumber value={firms.data.data.length} className="text-[28px] font-semibold" /> Hotspots (24 h) – <a className="text-accent" href="/map">{t("nav.map")}</a>
              </div>
            ) : (
              <ErrorState message={firms.data?.error ?? firms.error?.message ?? ""} compact />
            )}
            <DataMeta env={firms.data} className="px-4 pb-3" />
          </Card>
        )}
      </div>
    </SubPage>
  );
}
