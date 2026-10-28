/**
 * Shared, normalized data model used by server adapters and the client UI.
 */

/** Honest freshness labels shown on every data module. */
export type Freshness = "live" | "recent" | "delayed" | "cached" | "unavailable";

export type EventCategory =
  | "news"
  | "earthquake"
  | "weather-alert"
  | "disaster"
  | "wildfire"
  | "volcano"
  | "humanitarian"
  | "aviation"
  | "space"
  | "market";

/**
 * How precise a coordinate is. News items are only ever placed at country
 * level (approximate centroid) – we never invent precise coordinates.
 */
export type GeoPrecision = "exact" | "area" | "country";

export interface GeoPoint {
  lat: number;
  lon: number;
  precision: GeoPrecision;
}

export interface SourceRef {
  name: string;
  url?: string;
}

/** 0 = info, 1 = minor, 2 = moderate, 3 = severe, 4 = extreme */
export type Severity = 0 | 1 | 2 | 3 | 4;

export interface AtlasEvent {
  /** Stable id: `${provider}:${upstreamId}` */
  id: string;
  category: EventCategory;
  title: string;
  description?: string;
  locationName?: string;
  countryCode?: string;
  point?: GeoPoint;
  source: SourceRef;
  /** ISO timestamp the event happened / was published */
  time: string;
  /** ISO timestamp of the last upstream update, if known */
  updatedAt?: string;
  severity: Severity;
  url?: string;
  /** Category specific scalar values (magnitude, depth, …) */
  meta?: Record<string, string | number | boolean | null>;
}

export interface Attribution {
  name: string;
  url: string;
  license?: string;
}

/** Envelope returned by every /api/data/* endpoint. */
export interface ProviderEnvelope<T> {
  provider: string;
  label: string;
  data: T | null;
  /** When ATLAS last successfully fetched upstream (ISO) */
  fetchedAt: string | null;
  /** Newest timestamp reported by the upstream data itself (ISO) */
  sourceUpdatedAt: string | null;
  freshness: Freshness;
  /** Error from the latest attempt, if it failed */
  error: string | null;
  attribution: Attribution;
  refreshSeconds: number;
  /** Plain-language note about coverage limitations */
  note?: string;
}

export interface ProviderHealth {
  id: string;
  label: string;
  category: string;
  status: "ok" | "degraded" | "down" | "not-configured" | "idle";
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  refreshSeconds: number;
  requiresKey: string | null;
  attribution: Attribution;
  rateLimit: string;
  note?: string;
}
