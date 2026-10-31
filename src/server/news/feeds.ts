import type { Topic } from "@/lib/news/types";

export interface FeedDef {
  id: string;
  /** Outlet name – feeds of the same outlet count as one independent source */
  source: string;
  url: string;
  lang: "de" | "en";
  /** Topics implied by the feed itself (e.g. a business feed) */
  topics?: Topic[];
  /** Editorial weight 0..1 used for ranking only */
  reliability: number;
  homepage: string;
  /** Feed covers only Germany (domestic desk / regional broadcaster) */
  domestic?: boolean;
}

/**
 * Official RSS/Atom feeds published by the outlets for syndication of
 * headlines. ATLAS shows only headline, short teaser, timestamp and a link to
 * the original article – full text is never copied.
 */
export const FEEDS: FeedDef[] = [
  { id: "tagesschau", source: "tagesschau", url: "https://www.tagesschau.de/xml/rss2/", lang: "de", reliability: 0.9, homepage: "https://www.tagesschau.de" },
  { id: "dw-de", source: "DW", url: "https://rss.dw.com/rdf/rss-de-all", lang: "de", reliability: 0.9, homepage: "https://www.dw.com/de" },
  { id: "zdf", source: "ZDFheute", url: "https://www.zdf.de/rss/zdf/nachrichten", lang: "de", reliability: 0.85, homepage: "https://www.zdfheute.de" },
  { id: "spiegel", source: "DER SPIEGEL", url: "https://www.spiegel.de/schlagzeilen/index.rss", lang: "de", reliability: 0.8, homepage: "https://www.spiegel.de" },
  // German domestic & regional desks – feed the "Proteste Deutschland" tag (demos, strikes, rallies)
  { id: "tagesschau-inland", source: "tagesschau", url: "https://www.tagesschau.de/inland/index~rss2.xml", lang: "de", domestic: true, reliability: 0.9, homepage: "https://www.tagesschau.de/inland" },
  { id: "dlf", source: "Deutschlandfunk", url: "https://www.deutschlandfunk.de/nachrichten-100.rss", lang: "de", reliability: 0.9, homepage: "https://www.deutschlandfunk.de/nachrichten-100.html" },
  { id: "sz-politik", source: "Süddeutsche Zeitung", url: "https://rss.sueddeutsche.de/rss/Politik", lang: "de", reliability: 0.8, homepage: "https://www.sueddeutsche.de/politik" },
  { id: "zeit-de", source: "ZEIT ONLINE", url: "https://newsfeed.zeit.de/politik/deutschland/index", lang: "de", domestic: true, reliability: 0.8, homepage: "https://www.zeit.de/politik/deutschland/index" },
  { id: "spiegel-de", source: "DER SPIEGEL", url: "https://www.spiegel.de/politik/deutschland/index.rss", lang: "de", domestic: true, reliability: 0.8, homepage: "https://www.spiegel.de/politik/deutschland/" },
  { id: "taz", source: "taz", url: "https://taz.de/!p4608;rss/", lang: "de", reliability: 0.75, homepage: "https://taz.de" },
  { id: "fr-politik", source: "Frankfurter Rundschau", url: "https://www.fr.de/politik/rssfeed.rdf", lang: "de", reliability: 0.75, homepage: "https://www.fr.de/politik/" },
  { id: "mdr", source: "MDR", url: "https://www.mdr.de/nachrichten/index~rss2.xml", lang: "de", domestic: true, reliability: 0.85, homepage: "https://www.mdr.de/nachrichten/" },
  { id: "rbb24", source: "rbb24", url: "https://www.rbb24.de/aktuell/index.xml/feed=rss.xml", lang: "de", domestic: true, reliability: 0.85, homepage: "https://www.rbb24.de" },
  { id: "wdr", source: "WDR", url: "https://www1.wdr.de/uebersicht-100.feed", lang: "de", domestic: true, reliability: 0.85, homepage: "https://www1.wdr.de/nachrichten/" },
  { id: "swr", source: "SWR", url: "https://www.swr.de/~rss/swraktuell/swraktuell-100.xml", lang: "de", domestic: true, reliability: 0.85, homepage: "https://www.swr.de/swraktuell/" },
  { id: "hessenschau", source: "hessenschau", url: "https://www.hessenschau.de/index.rss", lang: "de", domestic: true, reliability: 0.85, homepage: "https://www.hessenschau.de" },
  { id: "bbc-world", source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml", lang: "en", reliability: 0.9, homepage: "https://www.bbc.com/news/world" },
  { id: "bbc-business", source: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml", lang: "en", topics: ["economy"], reliability: 0.9, homepage: "https://www.bbc.com/news/business" },
  { id: "bbc-tech", source: "BBC", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", lang: "en", topics: ["technology"], reliability: 0.9, homepage: "https://www.bbc.com/news/technology" },
  { id: "bbc-science", source: "BBC", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", lang: "en", topics: ["science"], reliability: 0.9, homepage: "https://www.bbc.com/news/science_and_environment" },
  { id: "dw-en", source: "DW", url: "https://rss.dw.com/rdf/rss-en-all", lang: "en", reliability: 0.9, homepage: "https://www.dw.com/en" },
  { id: "aljazeera", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", lang: "en", reliability: 0.8, homepage: "https://www.aljazeera.com" },
  { id: "france24", source: "France 24", url: "https://www.france24.com/en/rss", lang: "en", reliability: 0.85, homepage: "https://www.france24.com/en/" },
  { id: "guardian-world", source: "The Guardian", url: "https://www.theguardian.com/world/rss", lang: "en", reliability: 0.85, homepage: "https://www.theguardian.com/world" },
  { id: "npr-world", source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", lang: "en", reliability: 0.85, homepage: "https://www.npr.org/sections/world/" },
  { id: "nyt-world", source: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", lang: "en", reliability: 0.85, homepage: "https://www.nytimes.com/section/world" },
  { id: "un-news", source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", lang: "en", reliability: 0.85, homepage: "https://news.un.org/en/" },
  { id: "who", source: "WHO", url: "https://www.who.int/rss-feeds/news-english.xml", lang: "en", topics: ["health"], reliability: 0.9, homepage: "https://www.who.int/news" },
  { id: "nasa", source: "NASA", url: "https://www.nasa.gov/news-release/feed/", lang: "en", topics: ["space"], reliability: 0.9, homepage: "https://www.nasa.gov/news/" },
  { id: "simpleflying", source: "Simple Flying", url: "https://simpleflying.com/feed/", lang: "en", topics: ["aviation"], reliability: 0.6, homepage: "https://simpleflying.com" },
];
