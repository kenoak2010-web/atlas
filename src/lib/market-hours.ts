/** Regular trading sessions (local exchange time). Public holidays are not modelled. */
export const EXCHANGES = [
  { id: "nyse", name: "NYSE / Nasdaq", tz: "America/New_York", sessions: [[570, 960]] },
  { id: "xetra", name: "Xetra (Frankfurt)", tz: "Europe/Berlin", sessions: [[540, 1050]] },
  { id: "lse", name: "London Stock Exchange", tz: "Europe/London", sessions: [[480, 990]] },
  { id: "tse", name: "Tokyo Stock Exchange", tz: "Asia/Tokyo", sessions: [[540, 690], [750, 930]] },
  { id: "hkex", name: "Hong Kong (HKEX)", tz: "Asia/Hong_Kong", sessions: [[570, 720], [780, 960]] },
] as const;

function localParts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { weekday: get("weekday"), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isOpen(ex: (typeof EXCHANGES)[number], d = new Date()): boolean {
  const { weekday, minutes } = localParts(d, ex.tz);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return ex.sessions.some(([a, b]) => minutes >= a && minutes < b);
}

export function localTime(tz: string, d = new Date()): string {
  return d.toLocaleTimeString("de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}

/** Progress (0–1) through the current trading session, or null when closed. */
export function sessionProgress(ex: (typeof EXCHANGES)[number], d = new Date()): number | null {
  const { weekday, minutes } = localParts(d, ex.tz);
  if (weekday === "Sat" || weekday === "Sun") return null;
  const first = ex.sessions[0][0];
  const last = ex.sessions[ex.sessions.length - 1][1];
  if (!ex.sessions.some(([a, b]) => minutes >= a && minutes < b)) return null;
  return (minutes - first) / (last - first);
}
