import type { NewsCluster, ScoreBreakdown } from "./types";

export interface Interests {
  topics: string[];
  countries: string[];
}

/**
 * Transparent importance score. It ranks what is *reported*, weighted by
 * severity keywords, number of independent outlets, recency, editorial
 * source weight and the user's interests. It is not a measure of danger or truth.
 */
export function scoreCluster(
  c: Pick<NewsCluster, "sourceCount" | "lastUpdated" | "articles" | "topics" | "countries">,
  severity: number,
  now = Date.now(),
  interests?: Interests,
): ScoreBreakdown {
  const ageHours = Math.max(0, (now - Date.parse(c.lastUpdated)) / 3600_000);
  const sev = Math.min(4, Math.max(0, severity)) * 10;
  const sources = Math.min(Math.max(c.sourceCount - 1, 0), 5) * 8;
  const recency = 30 * Math.exp(-ageHours / 6);
  const rel = (c.articles.reduce((s, a) => s + a.reliability, 0) / Math.max(c.articles.length, 1)) * 10;
  let interest = 0;
  if (interests) {
    if (c.topics.some((t) => interests.topics.includes(t))) interest += 10;
    if (c.countries.some((k) => interests.countries.includes(k))) interest += 10;
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    severity: round(sev),
    sources: round(sources),
    recency: round(recency),
    reliability: round(rel),
    interest,
    total: round(sev + sources + recency + rel + interest),
  };
}

/** Re-rank on the client with the user's interests without re-clustering. */
export function applyInterests(clusters: NewsCluster[], interests: Interests): NewsCluster[] {
  return clusters
    .map((c) => {
      let interest = 0;
      if (c.topics.some((t) => interests.topics.includes(t))) interest += 10;
      if (c.countries.some((k) => interests.countries.includes(k))) interest += 10;
      const base = c.score.total - c.score.interest;
      return { ...c, score: { ...c.score, interest, total: Math.round((base + interest) * 10) / 10 } };
    })
    .sort((a, b) => b.score.total - a.score.total);
}
