"use client";

import { Star } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/store";
import { EXCHANGES, isOpen, localTime } from "@/lib/market-hours";
import { formatNumber, formatPct } from "@/lib/format";
import type { Quote } from "@/server/providers/markets";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Sparkline, cn, useMounted, useNow } from "../ui";

type Hist = Record<string, { t: string; v: number }[]>;

function QuoteRow({ q, hist }: { q: Quote; hist?: number[] }) {
  const { lang } = useT();
  const watched = usePrefs((s) => s.watchlist.includes(q.id));
  const toggle = usePrefs((s) => s.toggleIn);
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button onClick={() => toggle("watchlist", q.id)} aria-pressed={watched} aria-label="Watchlist" className={watched ? "text-yellow" : "text-text-3"}>
        <Star size={16} fill={watched ? "currentColor" : "none"} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{q.label}</div>
        <div className="truncate text-[11px] text-text-3">{q.delayNote} · {q.asOf.slice(0, 10)}</div>
      </div>
      <div className="w-16">{hist && hist.length > 1 && <Sparkline values={hist} />}</div>
      <div className="w-28 text-right">
        <div className="text-[15px] font-semibold tabular">{formatNumber(q.price, lang, q.group === "fx" ? 4 : 2)}</div>
        <div className={cn("text-[12px] tabular", q.changePct == null ? "text-text-3" : up ? "text-green" : "text-red")}>{formatPct(q.changePct, lang)}</div>
      </div>
    </div>
  );
}

export function EconomyScreen() {
  const { t, lang } = useT();
  useNow(60_000);
  const mounted = useMounted();
  const idx = useProvider<{ quotes: Quote[]; history: Hist }>("markets");
  const crypto = useProvider<Quote[]>("crypto");
  const btc = useProvider<{ t: string; v: number }[]>("crypto-chart", { id: "bitcoin" });
  const eth = useProvider<{ t: string; v: number }[]>("crypto-chart", { id: "ethereum" });
  const fx = useProvider<{ quotes: Quote[]; history: Hist }>("fx");
  const watched = usePrefs((s) => s.watchlist);
  const news = useNews();
  const econ = news.clusters.filter((c) => c.topics.includes("economy")).slice(0, 8);
  const all: { q: Quote; h?: number[] }[] = [
    ...(idx.data?.data?.quotes ?? []).map((q) => ({ q, h: idx.data?.data?.history[q.id]?.map((x) => x.v) })),
    ...(crypto.data?.data ?? []).map((q) => ({ q, h: (q.id === "bitcoin" ? btc : eth).data?.data?.map((x) => x.v) })),
    ...(fx.data?.data?.quotes ?? []).map((q) => ({ q, h: fx.data?.data?.history[q.id]?.map((x) => x.v) })),
  ];
  const group = (g: Quote["group"]) => all.filter((x) => x.q.group === g);
  const section = (title: string, rows: typeof all, env: typeof idx.data | typeof crypto.data, pending: boolean, note?: string) => (
    <Card>
      <CardHeader title={title} subtitle={note} />
      {pending ? <ListSkeleton /> : rows.length ? <Divided>{rows.map((r) => <QuoteRow key={r.q.id} q={r.q} hist={r.h} />)}</Divided> : <ErrorState message={env?.error ?? ""} />}
      <DataMeta env={env} className="px-4 pt-2 pb-3" />
    </Card>
  );
  return (
    <SubPage title={t("explore.economy")}>
      {watched.length > 0 && (
        <Card>
          <CardHeader title={t("economy.watchlist")} />
          <Divided>{all.filter((r) => watched.includes(r.q.id)).map((r) => <QuoteRow key={r.q.id} q={r.q} hist={r.h} />)}</Divided>
          <div className="pb-2" />
        </Card>
      )}
      {section(t("economy.indices"), group("index"), idx.data, idx.isPending, t("economy.indicesNote"))}
      {section(t("economy.commodities"), group("commodity"), idx.data, idx.isPending)}
      {section(t("economy.crypto"), group("crypto"), crypto.data, crypto.isPending)}
      {section(t("economy.fx"), group("fx"), fx.data, fx.isPending, fx.data?.note)}
      <Card>
        <CardHeader title={t("economy.hours")} subtitle={lang === "de" ? "Reguläre Handelszeiten, ohne Feiertage" : "Regular sessions, holidays not included"} />
        {mounted && <Divided>
          {EXCHANGES.map((ex) => {
            const open = isOpen(ex);
            return (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                <span className={cn("h-2 w-2 rounded-full", open ? "bg-green" : "bg-text-3")} />
                <span className="flex-1">{ex.name}</span>
                <span className="text-text-2 tabular">{localTime(ex.tz)}</span>
                <span className={cn("w-24 text-right font-medium", open ? "text-green" : "text-text-2")}>{open ? t("economy.open") : t("economy.closed")}</span>
              </div>
            );
          })}
        </Divided>}
        <div className="pb-2" />
      </Card>
      <Card>
        <CardHeader title={t("economy.news")} />
        {econ.length ? <Divided>{econ.map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
        <div className="pb-2" />
      </Card>
    </SubPage>
  );
}
