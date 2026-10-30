// Builds a tiny offline basemap (Natural Earth 1:110m land, public domain, via world-atlas).
// Used when the online tile service is unreachable (offline PWA, outages).
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = require("world-atlas/countries-110m.json");
const geo = feature(topo, topo.objects.countries);
const iso2ByNumeric = new Map(require("world-countries").map((c) => [c.ccn3, c.cca2]));
const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));
// Rings that cross the antimeridian (Russia, Fiji) are shifted east so they render without
// horizontal artefacts; Antarctica is dropped (no event layers there, and it distorts at low zoom).
const fixRing = (ring) => (ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180) ? ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : ring);
geo.features = geo.features.filter((f) => f.properties.name !== "Antarctica");
for (const f of geo.features) {
  const g = f.geometry;
  g.coordinates = g.type === "Polygon" ? g.coordinates.map(fixRing) : g.coordinates.map((poly) => poly.map(fixRing));
  f.geometry.coordinates = round(f.geometry.coordinates);
  f.properties = { name: f.properties.name, iso2: iso2ByNumeric.get(String(f.id).padStart(3, "0")) ?? null };
}
mkdirSync("public/basemap", { recursive: true });
writeFileSync("public/basemap/countries-110m.geojson", JSON.stringify(geo));
console.log("basemap features:", geo.features.length);
