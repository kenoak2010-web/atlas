/**
 * Astronomical calculations done locally (no data source needed):
 * sub-solar point, day/night terminator, sunrise/sunset and moon phase.
 * Based on the NOAA solar calculator equations; accuracy is about a minute for
 * sun times and a few hours for moon phase – plenty for a dashboard.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function julian(ms: number): number {
  return ms / 86_400_000 + 2440587.5;
}

/** Solar declination (deg) and equation of time (minutes) for an instant. */
export function solarPosition(ms: number): { declination: number; eqTime: number } {
  const t = (julian(ms) - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * L0 * RAD) - 2 * e * Math.sin(M * RAD) + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) - 0.5 * y * y * Math.sin(4 * L0 * RAD) - 1.25 * e * e * Math.sin(2 * M * RAD));
  return { declination, eqTime };
}

/** Point on Earth where the sun is directly overhead. */
export function subsolarPoint(ms: number): { lat: number; lon: number } {
  const { declination, eqTime } = solarPosition(ms);
  const d = new Date(ms);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  let lon = -((utcMin + eqTime) / 4 - 180);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: declination, lon };
}

/** Polygon (GeoJSON ring, lon/lat) covering the night side of the Earth. */
export function nightPolygon(ms: number, step = 2): [number, number][] {
  const sun = subsolarPoint(ms);
  const decl = Math.abs(sun.lat) < 0.01 ? 0.01 : sun.lat;
  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += step) {
    const lat = Math.atan(-Math.cos((lon - sun.lon) * RAD) / Math.tan(decl * RAD)) * DEG;
    ring.push([lon, lat]);
  }
  // Night covers the pole opposite to the sun's hemisphere.
  const pole = decl > 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole], ring[0]);
  return ring;
}

/** Sunrise / sunset (ISO) for a location and the UTC day containing `ms`. null = polar day/night. */
export function sunTimes(lat: number, lon: number, ms: number): { sunrise: string | null; sunset: string | null; polar: "day" | "night" | null } {
  const day = new Date(ms);
  const noonUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12);
  const { declination, eqTime } = solarPosition(noonUtc);
  const cosH = (Math.cos(90.833 * RAD) - Math.sin(lat * RAD) * Math.sin(declination * RAD)) / (Math.cos(lat * RAD) * Math.cos(declination * RAD));
  if (cosH > 1) return { sunrise: null, sunset: null, polar: "night" };
  if (cosH < -1) return { sunrise: null, sunset: null, polar: "day" };
  const ha = Math.acos(cosH) * DEG;
  const solarNoonMin = 720 - 4 * lon - eqTime;
  const base = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return {
    sunrise: new Date(base + (solarNoonMin - 4 * ha) * 60_000).toISOString(),
    sunset: new Date(base + (solarNoonMin + 4 * ha) * 60_000).toISOString(),
    polar: null,
  };
}

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export type MoonPhaseKey = "new" | "waxingCrescent" | "firstQuarter" | "waxingGibbous" | "full" | "waningGibbous" | "lastQuarter" | "waningCrescent";

export function moonPhase(ms: number): { ageDays: number; illumination: number; phase: MoonPhaseKey; fraction: number } {
  const age = ((((ms - KNOWN_NEW_MOON) / 86_400_000) % SYNODIC) + SYNODIC) % SYNODIC;
  const fraction = age / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const keys: MoonPhaseKey[] = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];
  const phase = keys[Math.floor(((fraction * 8 + 0.5) % 8))];
  return { ageDays: age, illumination, phase, fraction };
}
