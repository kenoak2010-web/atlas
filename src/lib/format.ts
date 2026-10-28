import type { Lang } from "./store";

const loc = (lang: Lang) => (lang === "de" ? "de-DE" : "en-GB");

export function relativeTime(iso: string | null | undefined, lang: Lang, now = Date.now()): string {
  if (!iso) return "–";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "–";
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(loc(lang), { numeric: "auto", style: "short" });
  if (abs < 45) return lang === "de" ? "gerade eben" : "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(iso, lang);
}

export function formatDateTime(iso: string | null | undefined, lang: Lang, opts: { utc?: boolean } = {}): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return (
    d.toLocaleString(loc(lang), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: opts.utc ? "UTC" : undefined,
    }) + (opts.utc ? " UTC" : "")
  );
}

export function formatDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(loc(lang), { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(d: Date, lang: Lang, timeZone?: string): string {
  return d.toLocaleTimeString(loc(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone });
}

export function formatNumber(n: number | null | undefined, lang: Lang, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString(loc(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPct(n: number | null | undefined, lang: Lang): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${n > 0 ? "+" : ""}${formatNumber(n, lang, 2)} %`;
}
