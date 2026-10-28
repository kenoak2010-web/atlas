import { XMLParser } from "fast-xml-parser";
import { htmlToText, safeUrl } from "@/lib/text";

export interface RawItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  guid: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Protect against entity-expansion attacks.
  processEntities: true,
  htmlEntities: false,
});

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}

function atomLink(v: unknown): string {
  for (const l of asArray(v as Record<string, string> | Record<string, string>[])) {
    if (typeof l === "string") return l;
    if (!l["@_rel"] || l["@_rel"] === "alternate") return l["@_href"] ?? "";
  }
  return "";
}

export function parseDate(v: string): string | null {
  if (!v) return null;
  const t = Date.parse(v.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Parse RSS 2.0, RSS 1.0 (RDF) and Atom documents into plain items. */
export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml);
  const items: Record<string, unknown>[] =
    asArray(doc?.rss?.channel?.item).length > 0
      ? asArray(doc.rss.channel.item)
      : asArray(doc?.["rdf:RDF"]?.item).length > 0
        ? asArray(doc["rdf:RDF"].item)
        : asArray(doc?.feed?.entry);

  const out: RawItem[] = [];
  for (const it of items) {
    const title = htmlToText(text(it.title), 300);
    const linkRaw = typeof it.link === "string" ? it.link : atomLink(it.link) || text(it.link);
    const link = safeUrl(linkRaw) ?? safeUrl(text(it.guid));
    if (!title || !link) continue;
    const summary = htmlToText(text(it.description) || text(it.summary) || text(it["content:encoded"]) || text(it.content), 320);
    const date = text(it.pubDate) || text(it["dc:date"]) || text(it.published) || text(it.updated);
    out.push({ title, link, summary, publishedAt: parseDate(date), guid: text(it.guid) || link });
  }
  return out;
}
