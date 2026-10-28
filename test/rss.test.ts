import { describe, expect, it } from "vitest";
import { parseFeed } from "@/server/news/rss";
import { toArticles } from "@/server/news/aggregate";

// Minimal documents in the RSS 2.0, RSS 1.0 (RDF) and Atom formats used by the configured feeds.
const RSS2 = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title><![CDATA[Earthquake strikes Japan]]></title><link>https://example.org/a</link>
<description><![CDATA[<p>A strong quake &amp; tsunami warning</p>]]></description><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate><guid>a1</guid></item>
<item><title>No date item</title><link>https://example.org/b</link></item>
<item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;

const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item rdf:about="https://example.org/dw"><title>Wahl in Frankreich</title><link>https://example.org/dw</link><description>Text</description><dc:date>2026-10-27T09:00:00Z</dc:date></item></rdf:RDF>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Launch</title>
<link rel="alternate" href="https://example.org/atom"/><summary>Rocket</summary><updated>2026-10-27T08:00:00Z</updated><id>x</id></entry></feed>`;

describe("parseFeed", () => {
  it("parses RSS 2.0", () => {
    const items = parseFeed(RSS2);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Earthquake strikes Japan", link: "https://example.org/a", summary: "A strong quake & tsunami warning" });
    expect(items[0].publishedAt).toBe("2026-10-27T10:00:00.000Z");
    expect(items[1].publishedAt).toBeNull();
  });
  it("parses RDF", () => {
    const [it0] = parseFeed(RDF);
    expect(it0).toMatchObject({ title: "Wahl in Frankreich", publishedAt: "2026-10-27T09:00:00.000Z" });
  });
  it("parses Atom", () => {
    const [it0] = parseFeed(ATOM);
    expect(it0).toMatchObject({ link: "https://example.org/atom", publishedAt: "2026-10-27T08:00:00.000Z" });
  });
});

describe("toArticles", () => {
  const feed = { id: "f", source: "Src", url: "", lang: "en" as const, reliability: 0.8, homepage: "" };
  it("drops undated, future and old items and tags topics/countries", () => {
    const now = Date.parse("2026-10-27T12:00:00Z");
    const arts = toArticles(feed, parseFeed(RSS2), now);
    expect(arts).toHaveLength(1);
    expect(arts[0].topics).toContain("disaster");
    expect(arts[0].countries).toEqual(["JP"]);
    const old = toArticles(feed, parseFeed(RSS2), now + 8 * 86400_000);
    expect(old).toHaveLength(0);
    const future = toArticles(feed, parseFeed(RSS2), Date.parse("2026-10-27T09:00:00Z"));
    expect(future).toHaveLength(0);
  });
});
