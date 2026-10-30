# ATLAS – Global Intelligence Center

A mobile-first Progressive Web App that brings real, attributed world data onto one screen:
news, earthquakes, weather and warnings, disasters, volcanoes, wildfires, aircraft, space,
markets and official live TV. Built for iPhone (Safari, Home Screen), German first with English.

- **Only real data.** Every module reads a documented public source; nothing is simulated.
  Each card shows its source, a timestamp and a freshness label
  (Live / Aktuell / Verzögert / Zwischengespeichert / Nicht verfügbar).
- **€0 to run.** Free, keyless sources by default; a few optional free keys unlock more.
- **No secrets in the browser.** All upstream calls run in server routes.

## Features

| Area | What you get |
|---|---|
| Übersicht | Animated 3D globe with live events and computed day/night line, headline ticker, world clocks, global activity index (transparent formula), weather + air quality, sun/moon/aurora, NASA EPIC Earth photo, “On this day”, reorderable widgets |
| Karte | MapLibre map with 3D globe mode and day/night shading: earthquakes, disasters (GDACS/EONET), weather warnings, volcanoes, fires, aircraft (viewport), ISS, news by country |
| Nachrichten | 18 official RSS feeds, deduplicated and clustered into stories, transparent ranking, topic/region filters, bookmarks |
| Live-TV | 13 official broadcaster streams via YouTube embeds + 2 official links, favourites |
| Entdecken | Hazards with magnitude histogram and timeline, weather (world cities, DWD/NWS warnings), aviation (altitude bands, climb/descent, sorting), space (ISS globe tracker with orbit, launches, Kp chart), economy (top movers, indices, oil, 7 coins with 7-day charts, crypto Fear & Greed, FX, market session progress), humanitarian, country dossiers |
| Timeline, Suche | Chronological feed grouped by day with a category breakdown; search with trending countries, ideas, news, events and places |
| Lagebriefing, Brennpunkte | Rule-based briefing assembled from live data (each line names its source); countries ranked by coverage and events |
| Warnungen | Rule-based in-app alerts: earthquakes above a magnitude, breaking news, severe weather, GDACS disasters, events near saved places, watchlist market moves |
| Personalisierung | Theme, language, refresh mode, topics, countries, places, watchlists – stored on the device |
| PWA | Installable, offline shell + last data, offline/online toast, pull to refresh, safe areas, dark mode |
| Motion | Page transitions, staggered lists, spring sheets, sliding tab and segmented highlights, self-drawing charts, count-up numbers; all disabled with “Reduce Motion” |

## Quick start

Requirements: Node.js 20+ (22 recommended).

```bash
npm install
cp .env.example .env.local   # optional keys, all may stay empty
npm run dev                  # http://localhost:3000
```

Behind an HTTP proxy, Node's `fetch` needs `NODE_USE_ENV_PROXY=1`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (vitest): cache, parsers, news clustering/scoring, providers, alerts, live TV |
| `npm run verify:sources` | Calls every provider through a running server and prints status, item count and timestamps |
| `node scripts/e2e-smoke.cjs` | Opens all 18 screens in an iPhone viewport (Playwright), fails on page/console/CSP errors, saves screenshots |
| `npm run check` | typecheck + lint + test + build |

## Testing

```bash
npm run check                       # static checks + unit tests
npm run build && npm start &        # production server on :3000
npm run verify:sources              # live upstream verification
node scripts/e2e-smoke.cjs          # browser smoke test (needs Playwright + Chromium)
SCHEME=dark node scripts/e2e-smoke.cjs /  /map   # dark mode, selected pages
```

## Architecture

```
src/
  app/                    routes (static client screens) + /api/data/[provider], /api/status
  server/
    providers/*.ts        one adapter per source: fetch → zod-validate → normalize
    news/                 feed list, RSS/Atom/RDF parser, article normalization
    cache.ts              in-memory TTL cache, request de-dup, exponential backoff, stale-on-error
    runner.ts, registry.ts
  lib/                    shared types, i18n, prefs store, news clustering/geotagging/scoring,
                          alerts engine, channels, formatting
  components/             screens, map, widgets, UI kit
public/sw.js              service worker (static cache-first, pages & API network-first)
```

Adding a source: create a `defineProvider({...})` adapter in `src/server/providers`, register it in
`registry.ts`, then call `useProvider("<id>")` in a component.

## Documentation

- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) – every source, refresh rate, key, limits, verification status
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) – deploy free on Vercel, install on iPhone
- [docs/APP_STORE.md](docs/APP_STORE.md) – native iOS app (Capacitor) and App Store release, in German
- [.env.example](.env.example) – optional configuration

## Known limitations

- **No background push.** Alerts and notifications only run while the app is open.
- **Markets are end-of-day.** S&P 500, NASDAQ, Dow, Nikkei and oil come from FRED (previous close,
  oil ~1 week behind). DAX, FTSE, Euro Stoxx and gold have no free permitted source and are not shown.
  FX = ECB reference rates (once per working day). Crypto is near real-time.
- **Aviation:** live positions only (OpenSky, current map area); no schedules, delays or airport boards.
- **No ships (AIS)** – no free, permitted global feed.
- **Live TV:** whether a stream can be embedded is the broadcaster's decision. Without `YOUTUBE_API_KEY`
  ATLAS uses YouTube's channel-based live embed, which sometimes shows "Video unavailable"; the official
  link is always next to the player. Embed playback could not be verified from the cloud test
  environment (YouTube blocks playback there for every video), so check it once on the iPhone.
- **GDELT** rate-limits shared/cloud IPs; it may show "Nicht verfügbar" on some hosts.
- **Smithsonian GVP** weekly report returned HTTP 403 on 2026-10-28; USGS HANS covers U.S. volcanoes and
  GDACS/EONET list major eruptions worldwide.
- **FIRMS fires and ReliefWeb** need free keys (`FIRMS_MAP_KEY`, `RELIEFWEB_APPNAME`).
- **News locations are country-level only**, and only when a country is named in the text.
- Server cache is per instance; on serverless hosts the CDN cache headers do the sharing.

## Future improvements

- Web Push (VAPID) with a small server-side subscription store for alerts while the app is closed
- Airport dataset (OurAirports) for an airport watchlist with live arrivals nearby
- More news feeds (ARD regional, Reuters/AP if a permitted feed exists) and per-feed toggles
- Persisted shared cache (e.g. Vercel KV / Upstash free tier) for cross-instance rate limiting
- Historical earthquake and disaster views; map time slider
- Optional account sync of preferences
