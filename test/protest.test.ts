import { describe, expect, it } from "vitest";
import { isGermanProtest } from "@/lib/news/protest";
import { detectCountries } from "@/lib/news/geotag";
import { toArticles } from "@/server/news/aggregate";
import type { FeedDef } from "@/server/news/feeds";

const de = (title: string, domestic = false, summary = "") => isGermanProtest(title, summary, detectCountries(`${title}. ${summary}`), domestic);

describe("Proteste Deutschland tag", () => {
  it("tags German demos, strikes and rallies", () => {
    expect(de("Tausende demonstrieren in Berlin gegen Rechtsextremismus")).toBe(true);
    expect(de("Verdi ruft zu Warnstreik im Nahverkehr auf")).toBe(true);
    expect(de("GDL kündigt neuen Bahnstreik an")).toBe(true);
    expect(de("Kundgebung vor dem Landtag in Dresden")).toBe(true);
    expect(de("Großdemo in München: Polizei zählt 50.000 Teilnehmer")).toBe(true);
    expect(de("Letzte Generation blockiert Autobahn")).toBe(true);
    expect(de("Lufthansa-Piloten streiken am Freitag")).toBe(true);
    expect(de("Warnstreiks legen Flughäfen in Deutschland lahm")).toBe(true);
    expect(de("Thousands protest in Germany over pension reform")).toBe(true);
  });

  it("uses the domestic feed as German context when no country is named", () => {
    expect(de("Mahnwache vor Rathaus nach tödlichem Unfall", true)).toBe(true);
    expect(de("Mahnwache vor Rathaus nach tödlichem Unfall", false)).toBe(false);
  });

  it("ignores foreign protests and non-protest words", () => {
    expect(de("Proteste in Georgien: Tausende auf den Straßen von Tiflis")).toBe(false);
    expect(de("Streik in Frankreich legt Züge lahm", true)).toBe(false);
    expect(de("Germany condemns crackdown on protesters in Iran")).toBe(false);
    expect(de("Israeli strike kills dozens in Gaza")).toBe(false);
    expect(de("Debatte über die Demokratie im Bundestag")).toBe(false);
    expect(de("Germany strikes deal with France on energy")).toBe(false);
    expect(de("Seeblockade vor Taiwan")).toBe(false);
    expect(de("Eine Million Italiener protestieren gegen Regierung", true)).toBe(false);
    expect(de("Proteste in Italien: Gewerkschaften machen gegen Meloni mobil")).toBe(false);
    expect(de("Schrottfahrräder blockieren in Berlin viele Stellplätze")).toBe(false);
    expect(de("Unser Fenster nach Georgien", false, "Oppositionelle im Knast, Demos in Berlin")).toBe(false);
    expect(de("Defektes Stellwerk bremst Züge", true, "Sind auch Demonstranten betroffen?")).toBe(false);
  });

  it("is attached by the aggregator and geotags the story to Germany", () => {
    const feed: FeedDef = { id: "x", source: "X", url: "https://example.org", lang: "de", domestic: true, reliability: 0.8, homepage: "https://example.org" };
    const now = Date.parse("2026-10-31T12:00:00Z");
    const [a] = toArticles(feed, [{ title: "Demo gegen Kürzungen vor dem Rathaus", summary: "", link: "https://example.org/1", guid: "1", publishedAt: "2026-10-31T10:00:00Z", image: null }], now);
    expect(a.topics).toContain("protest_de");
    expect(a.countries).toEqual(["DE"]);
  });
});
