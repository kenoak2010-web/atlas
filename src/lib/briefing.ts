/**
 * Rule-based situation briefing assembled from the live data ATLAS already
 * has. Every sentence states a fact from a named source; nothing is
 * generated, summarised by AI or guessed.
 */
import type { AtlasEvent } from "./types";
import type { NewsCluster } from "./news/types";

export interface BriefingInput {
  quakes: AtlasEvent[] | null;
  gdacs: AtlasEvent[] | null;
  news: NewsCluster[] | null;
  dwd: AtlasEvent[] | null;
  kp: number | null;
  crypto: { id: string; label: string; changePct: number | null }[] | null;
  indices: { label: string; changePct: number | null }[] | null;
}

export interface BriefingLine {
  icon: string;
  text: string;
  source: string;
  href?: string;
  /** 0 info … 4 extreme, for colouring */
  severity: number;
}

const pct = (v: number, lang: "de" | "en") => `${v > 0 ? "+" : ""}${v.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

export function buildBriefing(d: BriefingInput, lang: "de" | "en"): BriefingLine[] {
  const de = lang === "de";
  const out: BriefingLine[] = [];

  const breaking = (d.news ?? []).filter((c) => c.breaking).slice(0, 2);
  for (const c of breaking) out.push({ icon: "🔴", text: de ? `Eilmeldung: ${c.title}` : `Breaking: ${c.title}`, source: `${c.sourceCount} ${de ? "Quellen" : "sources"}`, severity: 3 });
  if (!breaking.length && d.news?.[0]) {
    const c = d.news[0];
    out.push({ icon: "📰", text: de ? `Top-Thema: ${c.title}` : `Top story: ${c.title}`, source: `${c.sourceCount} ${de ? "Quellen" : "sources"}`, severity: 1 });
  }

  if (d.quakes) {
    const mag = (e: AtlasEvent) => Number(e.meta?.magnitude ?? 0);
    const strongest = [...d.quakes].sort((a, b) => mag(b) - mag(a))[0];
    if (strongest) {
      const m = mag(strongest).toFixed(1);
      out.push({
        icon: "🌐",
        text: de
          ? `${d.quakes.length} Erdbeben ab M4.5 in 24 h, das stärkste M${m}: ${strongest.locationName ?? strongest.title}.`
          : `${d.quakes.length} quakes M4.5+ in 24 h, strongest M${m}: ${strongest.locationName ?? strongest.title}.`,
        source: "USGS",
        href: strongest.url,
        severity: mag(strongest) >= 7 ? 4 : mag(strongest) >= 6 ? 3 : 1,
      });
    } else out.push({ icon: "🌐", text: de ? "Keine Erdbeben ab M4.5 in den letzten 24 h." : "No M4.5+ earthquakes in the last 24 h.", source: "USGS", severity: 0 });
  }

  if (d.gdacs) {
    const red = d.gdacs.filter((e) => e.severity >= 4);
    const orange = d.gdacs.filter((e) => e.severity === 3);
    const top = red[0] ?? orange[0];
    if (top)
      out.push({
        icon: red.length ? "🟥" : "🟧",
        text: de
          ? `GDACS: ${red.length} rote, ${orange.length} orange Warnungen – u. a. ${top.title}.`
          : `GDACS: ${red.length} red, ${orange.length} orange alerts – incl. ${top.title}.`,
        source: "GDACS",
        href: top.url,
        severity: red.length ? 4 : 3,
      });
  }

  if (d.dwd) {
    const severe = d.dwd.filter((e) => e.severity >= 3);
    out.push(
      severe.length
        ? { icon: "⚠️", text: de ? `Deutschland: ${severe.length} Unwetterwarnungen (Stufe 3–4), u. a. ${severe[0].title}.` : `Germany: ${severe.length} severe weather warnings, incl. ${severe[0].title}.`, source: "DWD", severity: 3 }
        : { icon: "🌤️", text: de ? "Deutschland: keine Unwetterwarnungen der Stufe 3–4." : "Germany: no level 3–4 severe weather warnings.", source: "DWD", severity: 0 },
    );
  }

  if (d.kp != null && d.kp >= 5) {
    const g = d.kp >= 9 ? 5 : d.kp >= 8 ? 4 : d.kp >= 7 ? 3 : d.kp >= 6 ? 2 : 1;
    out.push({ icon: "🌌", text: de ? `Geomagnetischer Sturm G${g} (Kp ${d.kp.toFixed(1)}) – Polarlichter weit südlich möglich.` : `Geomagnetic storm G${g} (Kp ${d.kp.toFixed(1)}) – aurora possible far south.`, source: "NOAA SWPC", severity: g >= 3 ? 3 : 2 });
  }

  const moves = [...(d.indices ?? []), ...(d.crypto ?? [])].filter((q): q is { label: string; changePct: number } => q.changePct != null);
  if (moves.length) {
    const big = [...moves].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 3);
    out.push({
      icon: "📈",
      text: (de ? "Märkte: " : "Markets: ") + big.map((q) => `${q.label} ${pct(q.changePct, lang)}`).join(", ") + ".",
      source: "FRED · CoinGecko",
      severity: Math.abs(big[0].changePct) >= 5 ? 2 : 0,
    });
  }

  return out;
}
