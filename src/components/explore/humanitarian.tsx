"use client";

import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { Card, CardHeader, Divided, Empty, ListSkeleton } from "../ui";
import { EventListCard } from "./hazards";

export function HumanitarianScreen() {
  const { t, lang } = useT();
  const relief = useProvider<AtlasEvent[]>("humanitarian");
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const news = useNews();
  const items = news.clusters.filter((c) => c.articles.some((a) => a.feedId === "un-news" || a.feedId === "who")).slice(0, 10);
  const severe = { ...gdacs, data: gdacs.data ? { ...gdacs.data, data: (gdacs.data.data ?? []).filter((e) => e.severity >= 3) } : undefined };
  return (
    <SubPage title={t("explore.humanitarian")}>
      <EventListCard title="ReliefWeb (UN OCHA)" q={relief} />
      <EventListCard title={lang === "de" ? "GDACS Orange/Rot" : "GDACS orange/red"} q={severe} />
      <Card>
        <CardHeader title="UN News · WHO" />
        {news.isPending ? <ListSkeleton /> : items.length ? <Divided>{items.map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
        <div className="pb-2" />
      </Card>
    </SubPage>
  );
}
