// Generates src/data/countries.json from the world-countries dataset (ODbL, github.com/mledoze/countries).
// Run: node scripts/build-countries.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const countries = require("world-countries");

const out = countries
  .filter((c) => c.latlng?.length === 2)
  .map((c) => ({
    iso2: c.cca2,
    iso3: c.cca3,
    en: c.name.common,
    de: c.translations?.deu?.common ?? c.name.common,
    capital: c.capital?.[0] ?? null,
    region: c.region,
    subregion: c.subregion ?? null,
    lat: c.latlng[0],
    lon: c.latlng[1],
    area: c.area,
    flag: c.flag,
    demonym: c.demonyms?.eng?.m ?? null,
  }))
  .sort((a, b) => a.en.localeCompare(b.en));

writeFileSync(new URL("../src/data/countries.json", import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} countries`);
