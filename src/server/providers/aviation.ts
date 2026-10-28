import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson, UpstreamError, USER_AGENT } from "../http";

export interface Aircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lat: number;
  lon: number;
  /** metres */
  altitude: number | null;
  onGround: boolean;
  /** m/s */
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  squawk: string | null;
  lastContact: string;
}

const StateVector = z.array(z.unknown()).min(17);
const StatesResponse = z.object({ time: z.number(), states: z.array(StateVector).nullable() });

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizeStates(states: unknown[][]): Aircraft[] {
  const out: Aircraft[] = [];
  for (const s of states) {
    const lon = n(s[5]);
    const lat = n(s[6]);
    if (lat == null || lon == null) continue;
    out.push({
      icao24: String(s[0]),
      callsign: typeof s[1] === "string" && s[1].trim() ? s[1].trim() : null,
      originCountry: String(s[2] ?? ""),
      lat,
      lon,
      altitude: n(s[13]) ?? n(s[7]),
      onGround: s[8] === true,
      velocity: n(s[9]),
      heading: n(s[10]),
      verticalRate: n(s[11]),
      squawk: typeof s[14] === "string" ? s[14] : null,
      lastContact: new Date((n(s[4]) ?? 0) * 1000).toISOString(),
    });
  }
  return out;
}

/** Snap a bbox outward to a 2° grid so nearby map views share cache entries. */
export function snapBbox(b: [number, number, number, number]): [number, number, number, number] {
  const f = (v: number, up: boolean, lim: number) => Math.max(-lim, Math.min(lim, (up ? Math.ceil(v / 2) : Math.floor(v / 2)) * 2));
  return [f(b[0], false, 90), f(b[1], false, 180), f(b[2], true, 90), f(b[3], true, 180)];
}

let token: { value: string; expires: number } | null = null;

async function getToken(env: Record<string, string | undefined>): Promise<string | null> {
  const id = env.OPENSKY_CLIENT_ID;
  const secret = env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.expires > Date.now() + 30_000) return token.value;
  const res = await fetch("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    cache: "no-store",
  });
  if (!res.ok) throw new UpstreamError(`OpenSky auth failed (HTTP ${res.status})`, res.status);
  const j = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await res.json());
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export const openskyProvider = defineProvider({
  id: "aircraft",
  label: "OpenSky Network – live ADS-B state vectors",
  category: "aviation",
  refreshSeconds: 60,
  freshnessClass: "live",
  attribution: { name: "The OpenSky Network", url: "https://opensky-network.org", license: "Non-commercial use; cite OpenSky Network" },
  rateLimit: "Anonymous: 400 API credits/day, 10 s resolution. Registered (free OAuth client): 4,000 credits/day.",
  note: "Crowd-sourced ADS-B coverage – dense over Europe/North America, sparse over oceans, Africa and parts of Asia. Not all aircraft are visible.",
  params: z.object({
    bbox: z
      .string()
      .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
      .transform((s) => snapBbox(s.split(",").map(Number) as [number, number, number, number])),
  }),
  cacheKey: (p) => p.bbox.join(","),
  async fetch(p, ctx) {
    const [lamin, lomin, lamax, lomax] = p.bbox;
    if ((lamax - lamin) * (lomax - lomin) > 2500) throw new UpstreamError("Area too large – zoom in to load aircraft");
    const t = await getToken(ctx.env);
    const raw = await fetchJson(`https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      timeoutMs: 15_000,
    });
    const parsed = StatesResponse.parse(raw);
    const data = normalizeStates(parsed.states ?? []);
    return { data, sourceUpdatedAt: new Date(parsed.time * 1000).toISOString() };
  },
});
