/**
 * Transparent rules for the "Proteste Deutschland" tag: an article is tagged
 * when it mentions a protest form (demo, strike, rally, blockade …) AND has a
 * German context (Germany detected, a German state/city, a German union or
 * protest group, or it comes from a domestic German feed and names no other
 * country).
 */

// Strong protest forms (German + English). Matched case-insensitively with
// Unicode word boundaries, so "demo" does NOT hit "Demokratie".
const STRONG = [
  "demonstr(?:ation|ationen|ant|anten|antin|antinnen|ierende|ierenden|ierten|iert|ieren|ators?)",
  "(?:gegen|groß|klima|friedens)?demo(?:nstration)?(?:en|s)?",
  "kundgebung(?:en)?",
  "protest(?:e|en|s|ers?|ierende|ierenden|ieren|iert|ierten|zug|züge|aktion|aktionen|marsch|camp|welle|bewegung|kundgebung)?",
  "(?:warn|general|bahn|kita|klima|bauern|hunger|lokführer|piloten|schul|ärzte|post|hafen|flughafen)?streik(?:s|en|t|te|ten|ende|enden|tag|tage|welle|aufruf)?",
  "bestreik(?:t|en|ung)",
  "strikes?(?! (?:a |an |the )?(?:deal|agreement|balance|back|down|out|gold|chord|tone))", "striking", "walkouts?",
  "ausstand", "arbeitsniederlegung(?:en)?",
  "mahnwache(?:n)?", "sitzblockade(?:n)?", "menschenkette(?:n)?", "lichterkette(?:n)?",
  "aufmarsch", "aufmärsche", "klimakleber(?:n|in|innen)?", "traktorkorso", "autokorso",
  "auf die straße",
];

// Weaker words that are common in foreign/military/everyday news; they only
// count together with a German union, group or activists.
const WEAK = [
  "blockade(?:n)?", "blockier(?:t|en|ten)", "besetz(?:t|en|ten|ung)", "unruhen", "krawalle?", "ausschreitungen",
  "rally", "rallies", "marches", "protesters?",
];

// Unions and groups whose actions are German protests/strikes.
const GERMAN_ACTORS = [
  "verdi", "ver\\.di", "gdl", "evg", "ig metall", "ig bce", "ig bau", "dgb", "gew", "marburger bund", "vereinigung cockpit",
  "bauernverband", "letzte generation", "fridays for future", "extinction rebellion deutschland", "pegida", "querdenker",
  "deutsche bahn", "lufthansa", "bvg", "kvb", "mvg", "hvv", "rheinbahn", "üstra",
  "(?:klima)?aktivist(?:en|innen|in)?", "studierende", "gewerkschaft(?:en)?", "tarifverhandlung(?:en)?",
];

// Specific German places (states, cities) and national institutions.
const GERMAN_PLACES = [
  "baden-württemberg", "bayern", "brandenburg", "bremen", "hamburg", "hessen", "mecklenburg-vorpommern", "niedersachsen",
  "nordrhein-westfalen", "nrw", "rheinland-pfalz", "saarland", "sachsen", "sachsen-anhalt", "schleswig-holstein", "thüringen",
  "bavaria", "saxony", "thuringia", "lower saxony", "hesse",
  "berlin", "münchen", "munich", "köln", "cologne", "frankfurt", "stuttgart", "düsseldorf", "dortmund", "leipzig",
  "dresden", "hannover", "nürnberg", "nuremberg", "duisburg", "bochum", "wuppertal", "bielefeld", "bonn", "münster", "mannheim",
  "karlsruhe", "augsburg", "wiesbaden", "mainz", "kiel", "lübeck", "rostock", "magdeburg", "erfurt", "potsdam",
  "chemnitz", "freiburg", "heidelberg", "regensburg", "göttingen", "kassel", "braunschweig", "osnabrück", "oldenburg", "aachen",
  "saarbrücken", "jena", "würzburg", "ingolstadt", "darmstadt", "cottbus", "schwerin", "lützerath", "grünheide",
  "bundestag", "bundesrat", "bundesregierung", "kanzleramt", "bundesweit", "bundesländer", "landtag",
];

const word = (alts: string[]) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}])`, "iu");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STRONG_RE = word(STRONG);
const WEAK_RE = word(WEAK);
const ACTOR_RE = word(GERMAN_ACTORS);
const PLACE_RE = word(GERMAN_PLACES.map(esc));

// German demonyms the country geotagger misses ("Eine Million Italiener protestieren").
const FOREIGN_PEOPLE_RE = word([
  "italiener", "franzosen", "briten", "spanier", "griechen", "türken", "russen", "ukrainer", "israelis", "palästinenser", "iraner",
  "amerikaner", "serben", "georgier", "argentinier", "kenianer", "chilenen", "koreaner", "japaner", "chinesen", "inder",
  "niederländer", "belgier", "österreicher", "schweizer", "portugiesen", "ungarn", "tschechen", "slowaken", "rumänen", "bulgaren",
  "kroaten", "albaner", "mexikaner", "brasilianer", "kolumbianer", "venezolaner", "peruaner", "bolivianer", "nepalesen",
  "indonesier", "philippiner", "marokkaner", "tunesier", "ägypter", "nigerianer", "madagassen", "iraker", "syrer", "afghanen",
].map((w) => `${w}(?:n|innen)?`));

export function mentionsProtest(text: string): boolean {
  return STRONG_RE.test(text) || WEAK_RE.test(text);
}

/**
 * The protest word must be in the headline (teasers often mention protests in
 * passing); the German context may come from headline or teaser.
 * @param countries ISO2 codes detected in headline + teaser, in order of appearance (see geotag)
 * @param domesticFeed the feed only covers Germany (tagesschau Inland, regional broadcasters …)
 */
export function isGermanProtest(title: string, summary: string, countries: string[], domesticFeed = false): boolean {
  const strong = STRONG_RE.test(title);
  if (!strong && !WEAK_RE.test(title)) return false;
  const text = `${title}. ${summary}`;
  // A story that leads with another country ("Proteste in Georgien … auch Demos in Berlin") is not tagged.
  if ((countries.length && countries[0] !== "DE") || FOREIGN_PEOPLE_RE.test(title)) return false;
  // German unions/groups (Verdi, GDL, Letzte Generation …) are enough context.
  if (ACTOR_RE.test(text)) return true;
  // Weak words (blockiert, besetzt, Unruhen …) need such a group.
  if (!strong) return false;
  const place = PLACE_RE.test(text);
  // "Germany condemns crackdown on protesters in Iran": another country + only a generic German mention.
  if (countries.some((c) => c !== "DE")) return place;
  if (place || countries.includes("DE")) return true;
  // Domestic feed naming no country = Germany.
  return domesticFeed && countries.length === 0;
}
