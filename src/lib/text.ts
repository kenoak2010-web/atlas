const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", auml: "ä", ouml: "ö", uuml: "ü",
  Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

/** Convert an HTML fragment from a feed into plain text (rendered as text, never as HTML). */
export function htmlToText(html: string | undefined | null, maxLen = 400): string {
  if (!html) return "";
  let s = String(html)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  s = decodeEntities(decodeEntities(s)).replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
  return s;
}

/** Only allow absolute http(s) URLs; anything else (javascript:, data:) is dropped. */
export function safeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at for from by with as is are was were be been has have had it its this that these those " +
    "into over after before about than more most new says say said will would could can may might not no yes amid after " +
    "live update updates latest news video watch how why what who when where " +
    "der die das den dem des ein eine einer eines einem einen und oder aber von zu im in am an auf für mit bei als ist sind " +
    "war waren wird werden wurde hat haben nach vor über unter gegen nicht auch noch so wie was wer wo warum mehr neue neuer " +
    "sich er sie es man nur schon jetzt heute live ticker liveblog newsblog"
  ).split(/\s+/),
);

/** Tokenize a headline for similarity comparison (lowercase, no stopwords, crude stemming). */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w));
}

export function jaccard(a: Set<string>, b: Set<string>): { score: number; shared: number } {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return { score: union === 0 ? 0 : shared / union, shared };
}
