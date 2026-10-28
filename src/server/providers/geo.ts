/** Geometry helpers for upstream GeoJSON. */
type Pos = number[];

/** Representative point of a GeoJSON geometry (vertex average – good enough for marker placement). */
export function representativePoint(geom: { type: string; coordinates?: unknown } | null | undefined): { lat: number; lon: number } | null {
  if (!geom || !geom.coordinates) return null;
  const pts: Pos[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") pts.push(c as Pos);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geom.coordinates);
  if (!pts.length) return null;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
