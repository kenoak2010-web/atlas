import { XMLParser } from "fast-xml-parser";
import { htmlToText, safeUrl } from "@/lib/text";

export interface RawItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  guid: string;
  /** Teaser image offered by the feed itself (media:content, media:thumbnail, enclosure or inline <img>) */
  image: string | null;
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

function attrUrl(v: unknown, requireImage: boolean): string | null {
  for (const m of asArray(v as Record<string, string> | Record<string, string>[])) {
    if (!m || typeof m !== "object") continue;
    const url = m["@_url"] ?? m["@_href"];
    const type = m["@_type"] ?? "";
    const medium = m["@_medium"] ?? "";
    if (!url) continue;
    if (requireImage && !(type.startsWith("image/") || medium === "image" || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) continue;
    const u = safeUrl(url);
    if (u?.startsWith("https://")) return u;
  }
  return null;
}

/** Feed-provided teaser image, https only. */
export function feedImage(it: Record<string, unknown>): string | null {
  const group = it["media:group"] as Record<string, unknown> | undefined;
  const fromAttrs =
    attrUrl(it["media:content"], true) ??
    attrUrl(group?.["media:content"], true) ??
    attrUrl(it["media:thumbnail"], false) ??
    attrUrl(group?.["media:thumbnail"], false) ??
    attrUrl(it.enclosure, true);
  if (fromAttrs) return fromAttrs;
  const html = text(it["content:encoded"]) || text(it.description) || text(it.content);
  const m = /<img[^>]+src=["'](https:[^"']+)["']/i.exec(html);
  return m ? (safeUrl(m[1].replace(/&amp;/g, "&")) ?? null) : null;
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
    out.push({ title, link, summary, publishedAt: parseDate(date), guid: text(it.guid) || link, image: feedImage(it) });
  }
  return out;
}
