import { classifyTopics } from "@/lib/news/classify";
import { detectCountries } from "@/lib/news/geotag";
import { isGermanProtest } from "@/lib/news/protest";
import type { Article } from "@/lib/news/types";
import type { FeedDef } from "./feeds";
import type { RawItem } from "./rss";

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Turn raw feed items into normalized articles. Items without a date are dropped (no invented timestamps). */
export function toArticles(feed: FeedDef, items: RawItem[], now = Date.now()): Article[] {
  const out: Article[] = [];
  for (const it of items) {
    if (!it.publishedAt) continue;
    const t = Date.parse(it.publishedAt);
    // Ignore items dated in the future (> 10 min clock skew) or older than 7 days.
    if (t > now + 10 * 60_000 || now - t > 7 * 86400_000) continue;
    const text = `${it.title}. ${it.summary}`;
    const topics = classifyTopics(text, feed.topics);
    let countries = detectCountries(text);
    if (isGermanProtest(it.title, it.summary, countries, feed.domestic)) {
      topics.push("protest_de");
      if (!countries.length) countries = ["DE"];
    }
    out.push({
      id: `${feed.id}:${hash(it.guid)}`,
      title: it.title,
      summary: it.summary,
      url: it.link,
      feedId: feed.id,
      sourceName: feed.source,
      lang: feed.lang,
      publishedAt: it.publishedAt,
      topics,
      countries,
      reliability: feed.reliability,
      image: it.image,
    });
  }
  return out;
}
