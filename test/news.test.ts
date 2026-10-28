import { describe, expect, it } from "vitest";
import { clusterArticles, sameStory } from "@/lib/news/cluster";
import { applyInterests, scoreCluster } from "@/lib/news/score";
import { classifyTopics } from "@/lib/news/classify";
import { detectCountries } from "@/lib/news/geotag";
import { tokenize } from "@/lib/text";
import type { Article } from "@/lib/news/types";

const NOW = Date.parse("2026-10-27T12:00:00Z");
let n = 0;
function art(title: string, source: string, minutesAgo: number, extra: Partial<Article> = {}): Article {
  n++;
  return {
    id: `a${n}`,
    title,
    summary: "",
    url: `https://example.org/${n}`,
    feedId: source,
    sourceName: source,
    lang: "en",
    publishedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
    topics: classifyTopics(title),
    countries: detectCountries(title),
    reliability: 0.8,
    ...extra,
  };
}

describe("duplicate detection", () => {
  it("groups the same story from different outlets", () => {
    const a = new Set(tokenize("Magnitude 7.1 earthquake strikes off coast of Japan"));
    const b = new Set(tokenize("Strong earthquake strikes off Japan coast, tsunami warning issued"));
    const c = new Set(tokenize("Parliament votes on new budget in France"));
    expect(sameStory(a, b)).toBe(true);
    expect(sameStory(a, c)).toBe(false);
  });

  it("clusters and counts independent sources", () => {
    const clusters = clusterArticles(
      [
        art("Magnitude 7.1 earthquake strikes off coast of Japan", "BBC", 20),
        art("Strong earthquake strikes off Japan coast, tsunami warning", "DW", 30),
        art("Earthquake strikes off Japan coast: tsunami warning issued", "NPR", 40),
        art("Parliament votes on new budget in France", "BBC", 10),
      ],
      NOW,
    );
    expect(clusters).toHaveLength(2);
    const quake = clusters.find((c) => c.articles.length === 3)!;
    expect(quake.sourceCount).toBe(3);
    expect(quake.breaking).toBe(true);
    expect(quake.countries[0]).toBe("JP");
    expect(quake.point?.precision).toBe("country");
    expect(quake.regions).toContain("asia");
    const other = clusters.find((c) => c.articles.length === 1)!;
    expect(other.breaking).toBe(false);
  });

  it("does not mark single-source stories as breaking without urgency marker", () => {
    const [c] = clusterArticles([art("Minister resigns after scandal", "BBC", 5)], NOW);
    expect(c.breaking).toBe(false);
    // An urgency marker from a single outlet is not enough – it needs a second source.
    const [u] = clusterArticles([art("BREAKING: Minister resigns after scandal", "BBC", 5)], NOW);
    expect(u.breaking).toBe(false);
    const [u2] = clusterArticles([art("BREAKING: Minister resigns after scandal", "BBC", 5), art("Minister resigns after scandal erupts", "DW", 8)], NOW);
    expect(u2.breaking).toBe(true);
  });

  it("removes exact URL duplicates", () => {
    const a = art("Same", "BBC", 5);
    const clusters = clusterArticles([a, { ...a, id: "dup", url: a.url + "?utm=1" }], NOW);
    expect(clusters[0].articles).toHaveLength(1);
  });
});

describe("scoring", () => {
  it("prefers more sources and more recent items", () => {
    const base = { articles: [art("x", "A", 0)], topics: [], countries: [] };
    const recent = scoreCluster({ ...base, sourceCount: 1, lastUpdated: new Date(NOW).toISOString() }, 0, NOW);
    const old = scoreCluster({ ...base, sourceCount: 1, lastUpdated: new Date(NOW - 24 * 3600_000).toISOString() }, 0, NOW);
    const many = scoreCluster({ ...base, sourceCount: 4, lastUpdated: new Date(NOW).toISOString() }, 0, NOW);
    expect(recent.total).toBeGreaterThan(old.total);
    expect(many.total).toBeGreaterThan(recent.total);
    expect(many.sources).toBe(24);
  });

  it("boosts user interests transparently", () => {
    const clusters = clusterArticles([art("Election in Germany", "A", 60), art("Quiet day at the zoo", "B", 10)], NOW);
    const ranked = applyInterests(clusters, { topics: [], countries: ["DE"] });
    expect(ranked[0].countries).toContain("DE");
    expect(ranked[0].score.interest).toBe(10);
  });
});

describe("geotagging and topics", () => {
  it("detects countries in German and English", () => {
    expect(detectCountries("Kanzler reist nach Frankreich und in die Ukraine")).toEqual(["FR", "UA"]);
    expect(detectCountries("Talks in Washington over Gaza")).toEqual(["US", "PS"]);
  });
  it("avoids ambiguous names", () => {
    expect(detectCountries("Michael Jordan returns")).toEqual([]);
  });
  it("classifies topics", () => {
    expect(classifyTopics("Erdbeben erschüttert Region")).toContain("disaster");
    expect(classifyTopics("Central bank raises interest rate")).toContain("economy");
  });
});
