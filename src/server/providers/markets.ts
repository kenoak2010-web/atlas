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
}

/* ------------------------------------------------------------------ Crypto (CoinGecko) */

const COINS = [
  { id: "bitcoin", label: "Bitcoin" },
  { id: "ethereum", label: "Ethereum" },
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
    const raw = await fetchJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c.id).join(",")}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
      { headers: key ? { "x-cg-demo-api-key": key } : {} },
    );
    const rows = z.record(z.string(), z.object({ usd: z.number(), usd_24h_change: z.number().nullable().optional(), last_updated_at: z.number() })).parse(raw);
    const data: Quote[] = COINS.filter((c) => rows[c.id]).map((c) => ({
      id: c.id,
      label: c.label,
      group: "crypto",
      price: rows[c.id].usd,
      currency: "USD",
      changePct: rows[c.id].usd_24h_change ?? null,
      changeBasis: "24h",
      asOf: new Date(rows[c.id].last_updated_at * 1000).toISOString(),
      delayNote: "~1–2 min",
    }));
    const newest = data.reduce((m, d) => (d.asOf > m ? d.asOf : m), "");
    return { data, sourceUpdatedAt: newest || null };
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

/* ------------------------------------------------------------------ Indices & commodities (Stooq) */

export const STOOQ_SYMBOLS = [
  { sym: "^spx", id: "spx", label: "S&P 500", group: "index", currency: "USD" },
  { sym: "^ndq", id: "ndq", label: "NASDAQ Composite", group: "index", currency: "USD" },
  { sym: "^dji", id: "dji", label: "Dow Jones", group: "index", currency: "USD" },
  { sym: "^dax", id: "dax", label: "DAX", group: "index", currency: "EUR" },
  { sym: "^ukx", id: "ukx", label: "FTSE 100", group: "index", currency: "GBP" },
  { sym: "^nkx", id: "nkx", label: "Nikkei 225", group: "index", currency: "JPY" },
  { sym: "xauusd", id: "gold", label: "Gold (XAU/USD)", group: "commodity", currency: "USD" },
  { sym: "cb.f", id: "brent", label: "Brent Öl (Future)", group: "commodity", currency: "USD" },
  { sym: "cl.f", id: "wti", label: "WTI Öl (Future)", group: "commodity", currency: "USD" },
] as const;

/** Parse Stooq quote CSV (fields s,d2,t2,o,h,l,c). */
export function parseStooq(csv: string): Quote[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift()?.toLowerCase().split(",") ?? [];
  const idx = (n: string) => header.indexOf(n);
  const out: Quote[] = [];
  for (const line of lines) {
    const c = line.split(",");
    const sym = c[idx("symbol")]?.toLowerCase();
    const def = STOOQ_SYMBOLS.find((s) => s.sym === sym);
    const close = Number(c[idx("close")]);
    const open = Number(c[idx("open")]);
    const date = c[idx("date")];
    const time = c[idx("time")] ?? "00:00:00";
    if (!def || !Number.isFinite(close) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    out.push({
      id: def.id,
      label: def.label,
      group: def.group,
      price: close,
      currency: def.currency,
      changePct: Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : null,
      changeBasis: "since session open",
      // Stooq reports exchange-local/CET timestamps; we keep date+time without claiming a zone.
      asOf: `${date} ${time}`,
      delayNote: "delayed ≥ 15 min",
    });
  }
  return out;
}

export const stooqProvider = defineProvider({
  id: "markets",
  label: "Stooq – delayed index & commodity quotes",
  category: "market",
  refreshSeconds: 600,
  freshnessClass: "delayed",
  attribution: { name: "Stooq", url: "https://stooq.com", license: "Free quotes for personal use" },
  rateLimit: "Undocumented daily limit – ATLAS polls every 10 minutes with one batched request.",
  note: "Delayed quotes (typically 15+ minutes, some end-of-day). Change is measured since today's open.",
  params: z.object({}),
  cacheKey: () => "quotes",
  async fetch() {
    const syms = STOOQ_SYMBOLS.map((s) => s.sym).join("+");
    const csv = await fetchText(`https://stooq.com/q/l/?s=${encodeURIComponent(syms).replace(/%2B/g, "+")}&f=sd2t2ohlc&h&e=csv`);
    const data = parseStooq(csv);
    if (!data.length) throw new Error("Stooq returned no quotes");
    return { data, sourceUpdatedAt: null };
  },
});
