import countries from "@/data/countries.json";
import type { Region } from "./types";

export interface Country {
  iso2: string;
  iso3: string;
  en: string;
  de: string;
  capital: string | null;
  region: string;
  subregion: string | null;
  lat: number;
  lon: number;
  area: number;
  flag: string;
  demonym: string | null;
}

export const COUNTRIES = countries as Country[];
export const COUNTRY_BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));

// Names that are too ambiguous in English headlines (people, US states, words).
const AMBIGUOUS = new Set(["jordan", "chad", "georgia", "turkey", "guinea", "niger", "dominica", "jersey", "china town", "mali"]);

// Extra aliases commonly used by news outlets.
const ALIASES: Record<string, string[]> = {
  US: ["u.s.", "usa", "united states", "america", "american", "washington", "white house", "pentagon", "vereinigte staaten", "us-"],
  GB: ["uk", "u.k.", "britain", "british", "england", "scotland", "wales", "london", "großbritannien", "britische"],
  RU: ["russia", "russian", "kremlin", "moscow", "russland", "russische", "moskau", "kreml"],
  UA: ["ukraine", "ukrainian", "kyiv", "kiev", "kyjiw", "kiew", "ukrainische"],
  IL: ["israel", "israeli", "israelische", "tel aviv", "jerusalem", "netanyahu"],
  PS: ["gaza", "palestinian", "west bank", "westjordanland", "palästin"],
  CN: ["china", "chinese", "beijing", "peking", "chinesische"],
  TW: ["taiwan", "taipei"],
  IR: ["iran", "iranian", "tehran", "teheran"],
  KP: ["north korea", "nordkorea", "pyongyang"],
  KR: ["south korea", "südkorea", "seoul"],
  DE: ["germany", "german", "berlin", "deutschland", "bundesregierung", "bundestag"],
  FR: ["france", "french", "paris", "frankreich", "französische"],
  SY: ["syria", "syrian", "damascus", "syrien", "damaskus"],
  LB: ["lebanon", "lebanese", "beirut", "libanon"],
  YE: ["yemen", "houthi", "jemen", "huthi"],
  SD: ["sudan", "khartoum", "darfur"],
  CD: ["congo", "drc", "kongo", "kinshasa"],
  VE: ["venezuela", "caracas"],
  JO: ["jordanien", "amman", "jordanian"],
  TD: ["tschad", "n'djamena"],
  GE: ["georgien", "tbilisi", "tiflis"],
  TR: ["türkei", "turkish", "ankara", "erdogan", "türkiye"],
  NE: ["niamey"],
  ML: ["bamako", "malian"],
  IN: ["india", "indian", "new delhi", "indien"],
  PK: ["pakistan", "islamabad"],
  JP: ["japan", "japanese", "tokyo", "tokio"],
  EU: [],
};

interface Matcher {
  iso2: string;
  re: RegExp;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MATCHERS: Matcher[] = (() => {
  const out: Matcher[] = [];
  for (const c of COUNTRIES) {
    const names = new Set<string>();
    for (const n of [c.en, c.de, c.demonym]) {
      if (n && n.length > 3 && !AMBIGUOUS.has(n.toLowerCase())) names.add(n.toLowerCase());
    }
    for (const a of ALIASES[c.iso2] ?? []) names.add(a.toLowerCase());
    if (!names.size) continue;
    const alt = [...names].map(escape).join("|");
    // Unicode-aware word boundaries.
    out.push({ iso2: c.iso2, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}])`, "iu") });
  }
  return out;
})();

/** ISO2 codes of countries mentioned in text, in order of first appearance. */
export function detectCountries(text: string): string[] {
  const hits: { iso2: string; idx: number }[] = [];
  for (const m of MATCHERS) {
    const r = m.re.exec(text);
    if (r) hits.push({ iso2: m.iso2, idx: r.index });
  }
  return hits.sort((a, b) => a.idx - b.idx).map((h) => h.iso2);
}

export function regionOf(iso2: string): Region | null {
  const c = COUNTRY_BY_ISO2.get(iso2);
  if (!c) return null;
  switch (c.region) {
    case "Europe":
      return "europe";
    case "Americas":
      return "americas";
    case "Asia":
      return "asia";
    case "Africa":
      return "africa";
    case "Oceania":
      return "oceania";
    default:
      return null;
  }
}

export function countryPoint(iso2: string) {
  const c = COUNTRY_BY_ISO2.get(iso2);
  return c ? { lat: c.lat, lon: c.lon, precision: "country" as const } : null;
}
