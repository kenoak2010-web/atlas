import { jaccard, tokenize } from "../text";
import { hasUrgencyMarker, newsSeverity } from "./classify";
import { countryPoint, regionOf } from "./geotag";
import type { Article, NewsCluster, Region, Topic } from "./types";
import { scoreCluster, type Interests } from "./score";

const WINDOW_MS = 36 * 3600_000;

/** Two headlines describe the same story when they share enough distinctive words. */
export function sameStory(a: Set<string>, b: Set<string>): boolean {
  const { score, shared } = jaccard(a, b);
  return (shared >= 3 && score >= 0.3) || (shared >= 2 && score >= 0.5);
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

export function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Map<string, Article>();
  for (const a of articles) {
    const key = a.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (!seen.has(key)) seen.set(key, a);
  }
  return [...seen.values()];
}

export function clusterArticles(input: Article[], now = Date.now(), interests?: Interests): NewsCluster[] {
  const articles = dedupeArticles(input).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const tokens = articles.map((a) => new Set(tokenize(a.title)));
  const times = articles.map((a) => Date.parse(a.publishedAt));
  const uf = new UnionFind(articles.length);

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (Math.abs(times[i] - times[j]) > WINDOW_MS) continue;
      if (sameStory(tokens[i], tokens[j])) uf.union(i, j);
    }
  }

  const groups = new Map<number, Article[]>();
  articles.forEach((a, i) => {
    const r = uf.find(i);
    const g = groups.get(r);
    if (g) g.push(a);
    else groups.set(r, [a]);
  });

  const clusters: NewsCluster[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const lead = [...group].sort((a, b) => b.reliability - a.reliability || b.publishedAt.localeCompare(a.publishedAt))[0];
    const sources = new Set(group.map((a) => a.sourceName));
    const topics = [...new Set(group.flatMap((a) => a.topics))] as Topic[];
    // Countries: count mentions across articles, most frequent first.
    const counts = new Map<string, number>();
    for (const a of group) for (const c of a.countries) counts.set(c, (counts.get(c) ?? 0) + 1);
    const countries = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const regions = [...new Set(countries.map(regionOf).filter((r): r is Region => r !== null))];
    const lastUpdated = group[0].publishedAt;
    const firstSeen = group[group.length - 1].publishedAt;
    const text = group.map((a) => `${a.title} ${a.summary}`).join(" ");
    const severity = newsSeverity(text, topics);
    const ageMin = (now - Date.parse(lastUpdated)) / 60_000;
    const urgent = group.some((a) => hasUrgencyMarker(a.title));
    // "Breaking" needs fresh, independently confirmed AND serious news – or an explicit urgency marker.
    const breaking = (ageMin <= 90 && sources.size >= 3 && severity >= 2) || (urgent && ageMin <= 60 && sources.size >= 2);

    const cluster: NewsCluster = {
      id: `news:${lead.id}`,
      title: lead.title,
      summary: lead.summary,
      url: lead.url,
      lang: lead.lang,
      articles: group,
      sourceCount: sources.size,
      firstSeen,
      lastUpdated,
      topics,
      countries,
      regions,
      point: countries.length ? countryPoint(countries[0]) : null,
      breaking,
      image: lead.image ?? group.find((a) => a.image)?.image ?? null,
      score: { severity: 0, sources: 0, recency: 0, reliability: 0, interest: 0, total: 0 },
    };
    cluster.score = scoreCluster(cluster, severity, now, interests);
    clusters.push(cluster);
  }
  return clusters.sort((a, b) => b.score.total - a.score.total);
}
