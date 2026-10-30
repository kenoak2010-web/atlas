"use client";

import { Gauge, Star } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/store";
import { EXCHANGES, isOpen, localTime, sessionProgress } from "@/lib/market-hours";
import { formatNumber, formatPct } from "@/lib/format";
import type { FearGreed, Quote } from "@/server/providers/markets";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { AnimatedNumber, Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, Sparkline, cn, useMounted, useNow } from "../ui";

type Hist = Record<string, { t: string; v: number }[]>;

/** Coloured percentage pill, like a stock ticker. */
function PctPill({ v, className }: { v: number | null; className?: string }) {
  const { lang } = useT();
  return (
    <span
      className={cn(
        "inline-block min-w-[68px] rounded-lg px-2 py-1 text-center text-[13px] font-semibold text-white tabular transition-colors duration-500",
        v == null ? "bg-text-3/50" : v >= 0 ? "bg-green" : "bg-red",
        className,
      )}
    >
      {formatPct(v, lang)}
    </span>
  );
}

function QuoteRow({ q, hist }: { q: Quote; hist?: number[] }) {
  const { lang } = useT();
  const watched = usePrefs((s) => s.watchlist.includes(q.id));
  const toggle = usePrefs((s) => s.toggleIn);
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button onClick={() => toggle("watchlist", q.id)} aria-pressed={watched} aria-label="Watchlist" className={cn("press -m-1 p-1 transition-colors", watched ? "text-yellow" : "text-text-3")}>
        <Star key={String(watched)} size={16} fill={watched ? "currentColor" : "none"} className={watched ? "pop" : undefined} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{q.label}</div>
        <div className="truncate text-[11px] text-text-3">
          {q.marketCap ? `MCap ${formatNumber(q.marketCap / 1e9, lang, 0)} ${lang === "de" ? "Mrd." : "bn"} $ · ` : ""}
          {q.delayNote} · {q.asOf.slice(0, 10)}
        </div>
      </div>
      <div className="w-14 shrink-0">{hist && hist.length > 1 && <Sparkline values={hist} positive={q.changePct == null ? undefined : up} />}</div>
      <div className="w-[84px] shrink-0 text-right">
        <div className="text-[15px] font-semibold tabular">{formatNumber(q.price, lang, q.group === "fx" ? 4 : q.price < 10 ? 3 : 2)}</div>
        <PctPill v={q.changePct} className="mt-0.5 min-w-0 px-1.5 py-0.5 text-[11px]" />
      </div>
    </div>
  );
}

/** Horizontal strip with the biggest movers across all groups. */
function Movers({ rows }: { rows: { q: Quote; h?: number[] }[] }) {
  const { lang } = useT();
  const movers = rows.filter((r) => r.q.changePct != null).sort((a, b) => Math.abs(b.q.changePct!) - Math.abs(a.q.changePct!)).slice(0, 8);
  if (!movers.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
      {movers.map(({ q, h }, i) => {
        const up = q.changePct! >= 0;
        return (
          <div
            key={q.id}
            className="card rise-item w-[140px] shrink-0 snap-start p-3"
            style={{ animationDelay: `${i * 50}ms`, background: `linear-gradient(160deg, color-mix(in oklab, var(--${up ? "green" : "red"}) 22%, transparent), transparent 70%)` }}
          >
            <div className="truncate text-[12px] font-medium text-text-2">{q.label}</div>
            <div className={cn("text-[20px] font-bold tabular", up ? "text-green" : "text-red")}>
              {up ? "▲" : "▼"} <AnimatedNumber value={Math.abs(q.changePct!)} decimals={1} />%
            </div>
            <div className="text-[11px] text-text-3 tabular">{formatNumber(q.price, lang, q.group === "fx" ? 4 : 2)}</div>
            {h && h.length > 1 && <Sparkline values={h} positive={up} className="mt-1 h-6" />}
          </div>
        );
      })}
    </div>
  );
}

const FNG_COLORS = ["#ff453a", "#ff9f0a", "#ffd60a", "#a4de4b", "#30d158"];

/** Semicircle gauge for the crypto Fear & Greed Index (0–100). */
function FearGreedCard() {
  const { lang } = useT();
  const q = useProvider<FearGreed>("fear-greed");
  const d = q.data?.data;
  const de = lang === "de";
  const LABEL_DE: Record<string, string> = { "Extreme Fear": "Extreme Angst", Fear: "Angst", Neutral: "Neutral", Greed: "Gier", "Extreme Greed": "Extreme Gier" };
  const angle = d ? -90 + (d.value / 100) * 180 : -90;
  const color = d ? FNG_COLORS[Math.min(4, Math.floor(d.value / 20))] : "var(--text-3)";
  return (
    <Card>
      <CardHeader title={de ? "Krypto-Stimmung" : "Crypto sentiment"} icon={<Gauge size={18} />} subtitle={de ? "Fear & Greed Index von alternative.me, täglich" : "Fear & Greed Index by alternative.me, daily"} />
      {q.isPending ? (
        <ListSkeleton rows={2} />
      ) : d ? (
        <div className="flex items-center gap-4 px-4 pb-2">
          <div className="relative w-[150px] shrink-0">
            <svg viewBox="0 0 120 68" className="w-full" aria-hidden>
              <defs>
                <linearGradient id="fng" x1="0" x2="1">
                  {FNG_COLORS.map((c, i) => <stop key={c} offset={i / 4} stopColor={c} />)}
                </linearGradient>
              </defs>
              <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
              <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="url(#fng)" strokeWidth="10" strokeLinecap="round" pathLength={1} className="draw" />
              <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "60px 62px", transition: "transform 1200ms var(--ease-spring)" }}>
                <line x1="60" y1="62" x2="60" y2="20" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
              </g>
              <circle cx="60" cy="62" r="5" fill="var(--text)" />
            </svg>
          </div>
          <div className="min-w-0">
            <AnimatedNumber value={d.value} className="block text-[40px] leading-none font-bold" />
            <div className="mt-1 text-[15px] font-semibold" style={{ color }}>{de ? (LABEL_DE[d.label] ?? d.label) : d.label}</div>
            <div className="text-[11px] text-text-3">0 = {de ? "extreme Angst" : "extreme fear"} · 100 = {de ? "extreme Gier" : "extreme greed"}</div>
          </div>
        </div>
      ) : (
        <ErrorState message={q.data?.error ?? ""} onRetry={() => q.refetch()} compact />
      )}
      {d && d.history.length > 1 && (
        <div className="px-4">
          <Sparkline values={d.history.map((x) => x.v)} className="h-10" />
          <div className="flex justify-between text-[10px] text-text-3"><span>{de ? "vor 30 Tagen" : "30 days ago"}</span><span>{de ? "heute" : "today"}</span></div>
        </div>
      )}
      <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
    </Card>
  );
}

export function EconomyScreen() {
  const { t, lang } = useT();
  useNow(30_000);
  const mounted = useMounted();
  const idx = useProvider<{ quotes: Quote[]; history: Hist }>("markets");
  const crypto = useProvider<Quote[]>("crypto");
  const fx = useProvider<{ quotes: Quote[]; history: Hist }>("fx");
  const watched = usePrefs((s) => s.watchlist);
  const news = useNews();
  const econ = news.clusters.filter((c) => c.topics.includes("economy")).slice(0, 8);
  const all: { q: Quote; h?: number[] }[] = [
    ...(idx.data?.data?.quotes ?? []).map((q) => ({ q, h: idx.data?.data?.history[q.id]?.map((x) => x.v) })),
    ...(crypto.data?.data ?? []).map((q) => ({ q, h: q.spark })),
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
    <SubPage title={t("explore.economy")} subtitle={lang === "de" ? "Indizes, Rohstoffe, Krypto und Devisen – mit Zeitstempel und Verzögerung" : "Indices, commodities, crypto and FX – with timestamps and delays"}>
      <Movers rows={all} />
      {watched.length > 0 && (
        <Card>
          <CardHeader title={t("economy.watchlist")} />
          <Divided>{all.filter((r) => watched.includes(r.q.id)).map((r) => <QuoteRow key={r.q.id} q={r.q} hist={r.h} />)}</Divided>
          <div className="pb-2" />
        </Card>
      )}
      {section(t("economy.indices"), group("index"), idx.data, idx.isPending, t("economy.indicesNote"))}
      {section(t("economy.crypto"), group("crypto"), crypto.data, crypto.isPending, lang === "de" ? "Verlauf: 7 Tage" : "Chart: 7 days")}
      <FearGreedCard />
      {section(t("economy.commodities"), group("commodity"), idx.data, idx.isPending)}
      {section(t("economy.fx"), group("fx"), fx.data, fx.isPending, fx.data?.note)}
      <Card>
        <CardHeader title={t("economy.hours")} subtitle={lang === "de" ? "Reguläre Handelszeiten, ohne Feiertage" : "Regular sessions, holidays not included"} />
        {mounted && (
          <Divided>
            {EXCHANGES.map((ex) => {
              const open = isOpen(ex);
              const prog = sessionProgress(ex);
              return (
                <div key={ex.id} className="px-4 py-2.5 text-[14px]">
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", open ? "ping bg-green text-green" : "bg-text-3")} />
                    <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                    <span className="text-text-2 tabular">{localTime(ex.tz)}</span>
                    <span className={cn("w-24 text-right font-medium", open ? "text-green" : "text-text-2")}>{open ? t("economy.open") : t("economy.closed")}</span>
                  </div>
                  {prog != null && (
                    <div className="mt-1.5 ml-5 h-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-green transition-[width] duration-700" style={{ width: `${Math.round(prog * 100)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </Divided>
        )}
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
