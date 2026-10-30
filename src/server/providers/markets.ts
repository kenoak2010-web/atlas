import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson, fetchText } from "../http";

export interface Quote {
  id: string;
  label: string;
  group: "index" | "commodity" | "crypto" | "fx";
  price: number;
  currency: string;
  /** Percentage change vs. reference (see `changeBasis`) */
  changePct: number | null;
  changeBasis: string;
  asOf: string;
  delayNote: string;
  /** Optional 7-day price series (hourly), oldest first */
  spark?: number[];
  marketCap?: number | null;
}

/* ------------------------------------------------------------------ Crypto (CoinGecko) */

const COINS = [
  { id: "bitcoin", label: "Bitcoin" },
  { id: "ethereum", label: "Ethereum" },
  { id: "solana", label: "Solana" },
  { id: "ripple", label: "XRP" },
  { id: "binancecoin", label: "BNB" },
  { id: "cardano", label: "Cardano" },
  { id: "dogecoin", label: "Dogecoin" },
];

export const cryptoProvider = defineProvider({
  id: "crypto",
  label: "CoinGecko – crypto prices",
  category: "market",
  refreshSeconds: 120,
  freshnessClass: "periodic",
  attribution: { name: "CoinGecko", url: "https://www.coingecko.com/en/api", license: "Free API; attribution required" },
  rateLimit: "Public: ~5–15 calls/min; free Demo key: 30 calls/min, 10k/month.",
  note: "Aggregated spot price across exchanges; cached ~1–2 minutes.",
  params: z.object({}),
  cacheKey: () => "spot",
  async fetch(_p, ctx) {
    const key = ctx.env.COINGECKO_DEMO_KEY;
    const raw = await fetchJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.map((c) => c.id).join(",")}&sparkline=true&price_change_percentage=24h`, {
      headers: key ? { "x-cg-demo-api-key": key } : {},
    });
    const rows = z
      .array(
        z.object({
          id: z.string(),
          current_price: z.number(),
          market_cap: z.number().nullable().optional(),
          price_change_percentage_24h: z.number().nullable().optional(),
          last_updated: z.string(),
          sparkline_in_7d: z.object({ price: z.array(z.number()) }).nullable().optional(),
        }),
      )
      .parse(raw);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const data: Quote[] = COINS.filter((c) => byId.has(c.id)).map((c) => {
      const r = byId.get(c.id)!;
      const spark = r.sparkline_in_7d?.price ?? [];
      return {
        id: c.id,
        label: c.label,
        group: "crypto",
        price: r.current_price,
        currency: "USD",
        changePct: r.price_change_percentage_24h ?? null,
        changeBasis: "24h",
        asOf: new Date(r.last_updated).toISOString(),
        delayNote: "~1–2 min",
        // Thin the hourly series to keep the payload small.
        spark: spark.filter((_, i) => i % 3 === 0 || i === spark.length - 1),
        marketCap: r.market_cap ?? null,
      };
    });
    const newest = data.reduce((m, d) => (d.asOf > m ? d.asOf : m), "");
    return { data, sourceUpdatedAt: newest || null };
  },
});

/* ------------------------------------------------------------------ Crypto Fear & Greed (alternative.me) */

export interface FearGreed {
  value: number;
  label: string;
  time: string;
  history: { t: string; v: number }[];
}

export const fearGreedProvider = defineProvider({
  id: "fear-greed",
  label: "alternative.me – Crypto Fear & Greed Index",
  category: "market",
  refreshSeconds: 3600,
  freshnessClass: "delayed",
  attribution: { name: "Alternative.me", url: "https://alternative.me/crypto/fear-and-greed-index/", license: "Free API; attribution required" },
  rateLimit: "60 requests/min per IP (documented).",
  note: "Daily sentiment index 0–100 for the crypto market, updated once a day.",
  params: z.object({}),
  cacheKey: () => "fng30",
  async fetch() {
    const raw = await fetchJson("https://api.alternative.me/fng/?limit=30");
    const rows = z.object({ data: z.array(z.object({ value: z.string(), value_classification: z.string(), timestamp: z.string() })).min(1) }).parse(raw).data;
    const iso = (ts: string) => new Date(Number(ts) * 1000).toISOString();
    const data: FearGreed = {
      value: Number(rows[0].value),
      label: rows[0].value_classification,
      time: iso(rows[0].timestamp),
      history: rows.map((r) => ({ t: iso(r.timestamp), v: Number(r.value) })).reverse(),
    };
    return { data, sourceUpdatedAt: data.time };
  },
});

export const cryptoChartProvider = defineProvider({
  id: "crypto-chart",
  label: "CoinGecko – 30-day price history",
  category: "market",
  refreshSeconds: 3600,
  freshnessClass: "periodic",
  attribution: cryptoProvider.attribution,
  rateLimit: cryptoProvider.rateLimit,
  params: z.object({ id: z.enum(["bitcoin", "ethereum"]) }),
  cacheKey: (p) => p.id,
  async fetch(p, ctx) {
    const key = ctx.env.COINGECKO_DEMO_KEY;
    const raw = await fetchJson(`https://api.coingecko.com/api/v3/coins/${p.id}/market_chart?vs_currency=usd&days=30&interval=daily`, {
      headers: key ? { "x-cg-demo-api-key": key } : {},
    });
    const d = z.object({ prices: z.array(z.tuple([z.number(), z.number()])) }).parse(raw);
    const data = d.prices.map(([t, v]) => ({ t: new Date(t).toISOString(), v }));
    return { data, sourceUpdatedAt: data.at(-1)?.t ?? null };
  },
});

/* ------------------------------------------------------------------ FX (ECB via Frankfurter) */

const FxLatest = z.object({ base: z.string(), date: z.string(), rates: z.record(z.string(), z.number()) });
const FxSeries = z.object({ base: z.string(), start_date: z.string(), end_date: z.string(), rates: z.record(z.string(), z.record(z.string(), z.number())) });

/** Derive cross rates from EUR-based ECB reference rates. */
export function crossRates(r: Record<string, number>) {
  return {
    "EUR/USD": r.USD,
    "GBP/USD": r.USD / r.GBP,
    "USD/JPY": r.JPY / r.USD,
    "EUR/CHF": r.CHF,
  };
}

export const fxProvider = defineProvider({
  id: "fx",
  label: "ECB euro reference rates (via Frankfurter)",
  category: "market",
  refreshSeconds: 3600,
  freshnessClass: "delayed",
  attribution: { name: "European Central Bank via Frankfurter", url: "https://frankfurter.dev", license: "ECB reference rates – free use" },
  rateLimit: "No key, no documented limit; ATLAS polls hourly.",
  note: "Daily reference rates published by the ECB around 16:00 CET on working days – not live trading prices.",
  params: z.object({}),
  cacheKey: () => "latest",
  async fetch() {
    const end = new Date();
    const start = new Date(end.getTime() - 40 * 86400_000);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const raw = await fetchJson(`https://api.frankfurter.dev/v1/${day(start)}..${day(end)}?base=EUR&symbols=USD,GBP,JPY,CHF`);
    const s = FxSeries.parse(raw);
    const dates = Object.keys(s.rates).sort();
    if (dates.length < 1) throw new Error("No FX data");
    const last = crossRates(s.rates[dates.at(-1)!]);
    const prev = dates.length > 1 ? crossRates(s.rates[dates.at(-2)!]) : null;
    const quotes: Quote[] = (Object.keys(last) as (keyof typeof last)[]).map((pair) => ({
      id: pair,
      label: pair,
      group: "fx",
      price: last[pair],
      currency: pair.split("/")[1],
      changePct: prev ? ((last[pair] - prev[pair]) / prev[pair]) * 100 : null,
      changeBasis: "vs. previous ECB fixing",
      asOf: `${dates.at(-1)}T14:00:00.000Z`,
      delayNote: "ECB daily fixing",
    }));
    const history = Object.fromEntries(
      (Object.keys(last) as (keyof typeof last)[]).map((pair) => [pair, dates.map((d) => ({ t: d, v: crossRates(s.rates[d])[pair] }))]),
    );
    return { data: { quotes, history }, sourceUpdatedAt: `${dates.at(-1)}T14:00:00.000Z` };
  },
});

// Exported for tests
export { FxLatest };

/* ------------------------------------------------------------------ Indices & oil (FRED, St. Louis Fed) */

export const FRED_SERIES = [
  { id: "SP500", label: "S&P 500", group: "index", currency: "USD", note: "Schlusskurs Vortag / previous close", closeUtc: "21:00" },
  { id: "NASDAQCOM", label: "NASDAQ Composite", group: "index", currency: "USD", note: "Schlusskurs Vortag / previous close", closeUtc: "21:00" },
  { id: "DJIA", label: "Dow Jones", group: "index", currency: "USD", note: "Schlusskurs Vortag / previous close", closeUtc: "21:00" },
  { id: "NIKKEI225", label: "Nikkei 225", group: "index", currency: "JPY", note: "Letzter Schlusskurs / last close", closeUtc: "06:00" },
  { id: "DCOILBRENTEU", label: "Brent (Spot)", group: "commodity", currency: "USD", note: "EIA, ~1 Woche verzögert / ~1 week delay", closeUtc: "19:30" },
  { id: "DCOILWTICO", label: "WTI (Spot)", group: "commodity", currency: "USD", note: "EIA, ~1 Woche verzögert / ~1 week delay", closeUtc: "19:30" },
] as const;

/** Parse fredgraph.csv (header "observation_date,<ID>"; missing values are "." or empty). */
export function parseFredCsv(csv: string): { t: string; v: number }[] {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(","))
    .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && v !== "." && v !== "" && Number.isFinite(Number(v)))
    .map(([d, v]) => ({ t: d, v: Number(v) }));
}

export function fredQuote(def: (typeof FRED_SERIES)[number], rows: { t: string; v: number }[]): Quote | null {
  const last = rows.at(-1);
  if (!last) return null;
  const prev = rows.at(-2);
  return {
    id: def.id,
    label: def.label,
    group: def.group,
    price: last.v,
    currency: def.currency,
    changePct: prev ? ((last.v - prev.v) / prev.v) * 100 : null,
    changeBasis: "vs. previous close",
    // FRED gives dates only; approximate the session close (UTC), never later than now.
    asOf: new Date(Math.min(Date.parse(`${last.t}T${def.closeUtc}:00.000Z`), Date.now())).toISOString(),
    delayNote: def.note,
  };
}

export const fredProvider = defineProvider({
  id: "markets",
  label: "FRED (Federal Reserve Bank of St. Louis) – daily index & oil closes",
  category: "market",
  refreshSeconds: 3 * 3600,
  freshnessClass: "delayed",
  attribution: { name: "FRED, Federal Reserve Bank of St. Louis (S&P Dow Jones Indices, Nasdaq, Nikkei, EIA)", url: "https://fred.stlouisfed.org", license: "Personal, non-commercial use; index data © respective owners" },
  rateLimit: "Public CSV download, no key; ATLAS fetches every 3 hours.",
  note: "End-of-day closes (previous trading day), not live prices. DAX, FTSE 100 and gold have no free, licence-clean source and are not shown.",
  params: z.object({}),
  cacheKey: () => "eod",
  async fetch() {
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const results = await Promise.allSettled(
      FRED_SERIES.map((s) => fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.id}&cosd=${since}`, { timeoutMs: 25_000 })),
    );
    const quotes: Quote[] = [];
    const history: Record<string, { t: string; v: number }[]> = {};
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const rows = parseFredCsv(r.value);
      const q = fredQuote(FRED_SERIES[i], rows);
      if (q) {
        quotes.push(q);
        history[q.id] = rows.slice(-60);
      }
    });
    if (!quotes.length) throw new Error("FRED returned no data");
    const newest = quotes.filter((q) => q.group === "index").reduce((m, q) => (q.asOf > m ? q.asOf : m), "");
    return { data: { quotes, history }, sourceUpdatedAt: newest || null };
  },
});
