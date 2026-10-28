"use client";

import { useState } from "react";
import { useProvider, type ClientEnvelope } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import type { FirePoint } from "@/server/providers/hazards";
import { EventRow } from "../events";
import { SubPage } from "../sub-page";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Segmented } from "../ui";

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

export function HazardsScreen() {
  const { t } = useT();
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
  return (
    <SubPage title={t("explore.hazards")}>
      <div className="flex flex-wrap gap-2">
        <Segmented value={minMag} onChange={setMinMag} options={[{ value: "2.5", label: "M2.5+" }, { value: "4.5", label: "M4.5+" }, { value: "significant", label: "Sig." }]} />
        <Segmented value={range} onChange={setRange} options={[{ value: "day", label: t("time.24h") }, { value: "week", label: t("time.7d") }]} />
      </div>
      <EventListCard title={t("hazards.quakes")} q={quakes} />
      <EventListCard title={t("hazards.gdacs")} q={gdacs} />
      <EventListCard title={t("hazards.warningsDe")} q={de} />
      <EventListCard title={t("hazards.warningsUs")} q={us} />
      <EventListCard title={t("hazards.eonet")} q={eonet} showCategory />
      <EventListCard title={`${t("hazards.volcanoes")} – USA`} q={hans} />
      <EventListCard title={t("hazards.volcanoes")} q={gvp} />
      <Card>
        <CardHeader title={t("hazards.fires")} subtitle={t("hazards.firesNote")} />
        {firms.data?.data ? (
          <div className="px-4 pb-2 text-[15px]">
            <span className="text-[28px] font-semibold tabular">{firms.data.data.length.toLocaleString()}</span> Hotspots (24 h) – <a className="text-accent" href="/map">{t("nav.map")}</a>
          </div>
        ) : (
          <ErrorState message={firms.data?.error ?? firms.error?.message ?? ""} compact />
        )}
        <DataMeta env={firms.data} className="px-4 pb-3" />
      </Card>
    </SubPage>
  );
}
