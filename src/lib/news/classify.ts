import type { Topic } from "./types";

/**
 * Transparent keyword rules for topic classification (German + English).
 * Matches on word starts so "earthquake" also hits "earthquakes".
 */
export const TOPIC_KEYWORDS: Record<Exclude<Topic, "protest_de">, string[]> = {
  conflict: [
    "war", "military", "missile", "airstrike", "air strike", "troops", "ceasefire", "drone strike", "shelling", "attack", "militant",
    "hamas", "hezbollah", "nato", "invasion", "frontline", "insurgent", "rebels", "bombing", "killed in",
    "krieg", "militär", "rakete", "luftangriff", "truppen", "waffenruhe", "angriff", "beschuss", "front", "rebellen", "anschlag",
  ],
  politics: [
    "election", "president", "prime minister", "parliament", "government", "minister", "senate", "congress", "vote", "coalition",
    "summit", "sanction", "diplomat", "treaty", "chancellor", "opposition", "referendum", "protest",
    "wahl", "präsident", "premier", "parlament", "regierung", "minister", "bundestag", "koalition", "gipfel", "sanktion",
    "kanzler", "opposition", "abstimmung", "proteste", "diplomat",
  ],
  economy: [
    "economy", "economic", "inflation", "interest rate", "central bank", "stocks", "market", "gdp", "trade", "tariff", "recession",
    "oil price", "bank", "ecb", "federal reserve", "fed ", "jobs", "unemployment", "earnings", "imf",
    "wirtschaft", "inflation", "zins", "zentralbank", "ezb", "börse", "aktie", "handel", "zoll", "zölle", "rezession",
    "ölpreis", "konjunktur", "arbeitslos", "insolvenz",
  ],
  technology: [
    "technology", "tech ", "artificial intelligence", " ai ", "chip", "semiconductor", "cyber", "hack", "software", "apple", "google",
    "microsoft", "meta ", "openai", "smartphone", "data breach",
    "technologie", "künstliche intelligenz", " ki ", "halbleiter", "cyberangriff", "hacker", "datenleck",
  ],
  science: ["science", "scientist", "research", "study finds", "researchers", "physics", "biology", "wissenschaft", "forscher", "studie", "forschung"],
  aviation: [
    "airline", "aircraft", "airport", "flight", "plane", "boeing", "airbus", "aviation", "faa", "easa", "pilot", "air traffic",
    "fluggesellschaft", "flugzeug", "flughafen", "flug ", "flüge", "luftfahrt", "lufthansa", "flugverkehr",
  ],
  space: [
    "nasa", "esa ", "spacex", "rocket launch", "satellite", "astronaut", "space station", "iss ", "orbit", "moon", "mars", "starship",
    "raumfahrt", "rakete startet", "satellit", "astronaut", "raumstation", "mond", "weltraum",
  ],
  environment: [
    "climate", "emission", "global warming", "biodiversity", "pollution", "carbon", "cop3", "heatwave", "drought", "glacier",
    "klima", "emission", "erderwärmung", "umwelt", "hitzewelle", "dürre", "artensterben", "gletscher",
  ],
  disaster: [
    "earthquake", "tsunami", "hurricane", "typhoon", "cyclone", "flood", "wildfire", "volcano", "eruption", "landslide", "tornado",
    "storm", "evacuat", "death toll",
    "erdbeben", "tsunami", "hurrikan", "taifun", "zyklon", "hochwasser", "überschwemmung", "waldbrand", "vulkan", "ausbruch",
    "erdrutsch", "sturm", "evakuier", "todesopfer",
  ],
  health: [
    "health", "virus", "outbreak", "pandemic", "epidemic", "vaccine", "who ", "disease", "cholera", "ebola", "measles", "mpox", "hospital",
    "gesundheit", "virus", "ausbruch", "pandemie", "epidemie", "impf", "krankheit", "krankenhaus",
  ],
};

/** Feeds with a fixed topic (e.g. a business feed) pass `hint`. */
export function classifyTopics(text: string, hint: Topic[] = []): Topic[] {
  const hay = ` ${text.toLowerCase()} `;
  const found = new Set<Topic>(hint);
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS) as [Topic, string[]][]) {
    for (const w of words) {
      const needle = w.startsWith(" ") || w.endsWith(" ") ? w : ` ${w}`;
      if (hay.includes(needle) || hay.includes(`(${w.trim()}`) || hay.includes(`"${w.trim()}`)) {
        found.add(topic);
        break;
      }
    }
  }
  return [...found];
}

const URGENT = ["breaking", "eilmeldung", "just in", "urgent", "+++"];

export function hasUrgencyMarker(title: string): boolean {
  const t = title.toLowerCase();
  return URGENT.some((u) => t.includes(u));
}

/** Rough severity of a news cluster from its topics/keywords (0..4). */
export function newsSeverity(text: string, topics: string[]): number {
  const t = text.toLowerCase();
  let s = 0;
  if (topics.includes("conflict") || topics.includes("disaster")) s = 2;
  if (/\b(killed|dead|deaths|death toll|tote|getötet|todesopfer|massacre|massaker)\b/.test(t)) s = Math.max(s, 3);
  if (/\b(nuclear|atom|tsunami warning|tsunamiwarnung|state of emergency|notstand|coup|putsch)\b/.test(t)) s = Math.max(s, 3);
  if (topics.includes("politics") || topics.includes("economy")) s = Math.max(s, 1);
  return s;
}
