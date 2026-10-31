export type Topic =
  | "politics"
  | "conflict"
  | "economy"
  | "technology"
  | "science"
  | "aviation"
  | "space"
  | "environment"
  | "disaster"
  | "health"
  /** Demonstrations, strikes and rallies in Germany (see protest.ts) */
  | "protest_de";

export type Region = "europe" | "americas" | "asia" | "africa" | "oceania";

export interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  feedId: string;
  sourceName: string;
  lang: "de" | "en";
  publishedAt: string;
  topics: Topic[];
  /** ISO2 codes of countries mentioned in the headline/summary */
  countries: string[];
  /** Editorial weighting of the source (0..1). Not a measure of truth. */
  reliability: number;
  /** Teaser image URL provided by the feed (https), if any */
  image?: string | null;
}

export interface ScoreBreakdown {
  severity: number;
  sources: number;
  recency: number;
  reliability: number;
  interest: number;
  total: number;
}

export interface NewsCluster {
  id: string;
  title: string;
  summary: string;
  url: string;
  lang: "de" | "en";
  articles: Article[];
  sourceCount: number;
  firstSeen: string;
  lastUpdated: string;
  topics: Topic[];
  countries: string[];
  regions: Region[];
  /** Approximate country-level location (centroid). Never more precise. */
  point: { lat: number; lon: number; precision: "country" } | null;
  breaking: boolean;
  score: ScoreBreakdown;
  /** First available feed image among the cluster's articles */
  image?: string | null;
}

export interface FeedStatus {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface NewsPayload {
  clusters: NewsCluster[];
  feeds: FeedStatus[];
}
