import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson, fetchText } from "../http";
import { FEEDS } from "../news/feeds";
import { parseFeed } from "../news/rss";
import { toArticles } from "../news/aggregate";
import { clusterArticles } from "@/lib/news/cluster";
import type { Article, FeedStatus, NewsPayload } from "@/lib/news/types";
import { safeUrl } from "@/lib/text";

export const newsProvider = defineProvider({
  id: "news",
  label: "International news (official RSS feeds)",
  category: "news",
  refreshSeconds: 300,
  freshnessClass: "periodic",
  attribution: { name: "tagesschau, DW, ZDF, SPIEGEL, Deutschlandfunk, SZ, ZEIT, taz, FR, MDR, rbb24, WDR, SWR, hessenschau, BBC, Al Jazeera, France 24, Guardian, NPR, NYT, UN News, WHO, NASA, Simple Flying", url: "/sources" },
  rateLimit: "Each feed is requested at most once every 5 minutes.",
  note: "Headlines and teasers only, linked to the original article. Location = country mentioned in the headline (approximate).",
  params: z.object({}),
  cacheKey: () => "all",
  async fetch() {
    const now = Date.now();
    const results = await Promise.allSettled(FEEDS.map((f) => fetchText(f.url, { timeoutMs: 10_000, headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" } })));
    const feeds: FeedStatus[] = [];
    const articles: Article[] = [];
    const byUrl = new Map<string, Article>();
    results.forEach((r, i) => {
      const f = FEEDS[i];
      if (r.status === "fulfilled") {
        try {
          const items = toArticles(f, parseFeed(r.value), now);
          // Section feeds (e.g. tagesschau Inland) repeat items of the outlet's main feed.
          for (const it of items) {
            const prev = byUrl.get(it.url);
            if (!prev) {
              byUrl.set(it.url, it);
              articles.push(it);
            } else {
              for (const tp of it.topics) if (!prev.topics.includes(tp)) prev.topics.push(tp);
              if (!prev.countries.length) prev.countries = it.countries;
            }
          }
          feeds.push({ id: f.id, name: f.source, ok: true, count: items.length, error: null });
        } catch (e) {
          feeds.push({ id: f.id, name: f.source, ok: false, count: 0, error: `Parse error: ${(e as Error).message}` });
        }
      } else {
        feeds.push({ id: f.id, name: f.source, ok: false, count: 0, error: (r.reason as Error).message });
      }
    });
    if (!articles.length) throw new Error(`No news feed reachable (${feeds.filter((f) => !f.ok).length}/${feeds.length} failed)`);
    const clusters = clusterArticles(articles, now);
    const newest = articles.reduce((m, a) => (a.publishedAt > m ? a.publishedAt : m), "");
    const data: NewsPayload = { clusters, feeds };
    return { data, sourceUpdatedAt: newest };
  },
});

const GdeltResponse = z.object({
  articles: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        seendate: z.string(),
        domain: z.string().optional(),
        language: z.string().optional(),
        sourcecountry: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export interface GdeltArticle {
  url: string;
  title: string;
  seenAt: string;
  domain: string;
  language: string;
  sourceCountry: string;
}

/** GDELT seendate format: 20261028T101500Z */
export function parseGdeltDate(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
}

export const gdeltProvider = defineProvider({
  id: "gdelt",
  label: "GDELT DOC 2.0 news search",
  category: "news",
  refreshSeconds: 900,
  freshnessClass: "periodic",
  attribution: { name: "The GDELT Project", url: "https://www.gdeltproject.org/", license: "Free & open; cite GDELT" },
  rateLimit: "No key; max. 1 request every 5 seconds.",
  note: "Worldwide news search across many languages; titles as reported by GDELT.",
  params: z.object({
    q: z.string().trim().min(3).max(120),
    timespan: z.enum(["1h", "6h", "24h", "7d"]).default("24h"),
  }),
  cacheKey: (p) => `${p.q.toLowerCase()}|${p.timespan}`,
  async fetch(p) {
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.search = new URLSearchParams({
      query: p.q.includes(" ") && !p.q.includes('"') ? `"${p.q}"` : p.q,
      mode: "artlist",
      format: "json",
      maxrecords: "50",
      sort: "datedesc",
      timespan: p.timespan,
    }).toString();
    const raw = await fetchJson(url.toString(), { timeoutMs: 15_000 });
    const parsed = GdeltResponse.parse(raw);
    const data: GdeltArticle[] = [];
    for (const a of parsed.articles) {
      const u = safeUrl(a.url);
      const seenAt = parseGdeltDate(a.seendate);
      if (!u || !seenAt) continue;
      data.push({ url: u, title: a.title, seenAt, domain: a.domain ?? new URL(u).host, language: a.language ?? "", sourceCountry: a.sourcecountry ?? "" });
    }
    return { data, sourceUpdatedAt: data[0]?.seenAt ?? null };
  },
});
