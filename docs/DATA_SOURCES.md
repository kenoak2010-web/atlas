# ATLAS – Data source registry

Every module in ATLAS reads from one of the providers below through the server route
`/api/data/<id>`. The live status of each source is visible in the app under
**Einstellungen → Quellen** (`/sources`) and as JSON at `/api/status`.

Last live verification: **2026-10-28**, from a cloud container (`npm run verify:sources`).

| id | Source | Refresh | Key | Rate limit / terms | Verified 2026-10-28 |
|---|---|---|---|---|---|
| news | 18 official RSS feeds (list below) | 5 min | – | Each feed at most once per 5 min | ✅ 477 articles |
| gdelt | [GDELT DOC 2.0](https://www.gdeltproject.org/) article search | 15 min | – | Max 1 request / 5 s | ⚠️ HTTP 429 from shared cloud IP; degrades to "unavailable" |
| earthquakes | [USGS GeoJSON summary feeds](https://earthquake.usgs.gov/earthquakes/feed/) | 1 min | – | Poll ≤ 1/min | ✅ |
| weather | [Open-Meteo forecast](https://open-meteo.com/) | 15 min | – | < 10,000 calls/day, non-commercial | ✅ (occasional timeouts, retried once) |
| world-weather | Open-Meteo, 48 world cities in one batched call | 30 min | – | same | ✅ 48 cities |
| alerts-de | [DWD warnings.json](https://www.dwd.de) | 5 min | – | Open data | ✅ |
| alerts-us | [NOAA/NWS alerts API](https://www.weather.gov/documentation/services-web-api) (Severe/Extreme) | 5 min | – | User-Agent required | ✅ 23 alerts |
| gdacs | [GDACS event list](https://www.gdacs.org) (EQ, TC, FL, VO, DR, WF) | 10 min | – | Polled every 10 min | ✅ 86 events |
| eonet | [NASA EONET v3](https://eonet.gsfc.nasa.gov) open events | 30 min | – | – | ✅ 50 events |
| firms | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) VIIRS NOAA-20 NRT | 30 min | `FIRMS_MAP_KEY` | 5,000 transactions / 10 min | ⏸ not configured |
| volcanoes | [Smithsonian GVP weekly report](https://volcano.si.edu/reports_weekly.cfm) RSS | 6 h | – | – | ❌ upstream HTTP 403 (site outage) |
| volcanoes-us | [USGS HANS](https://volcanoes.usgs.gov) elevated volcanoes | 30 min | – | – | ✅ 4 volcanoes |
| humanitarian | [ReliefWeb API v2](https://reliefweb.int) current disasters | 30 min | `RELIEFWEB_APPNAME` | 1,000 calls/day, approved appname | ⏸ not configured |
| aircraft | [OpenSky Network](https://opensky-network.org) state vectors (map viewport, ≤ 2,500 sq°) | 1 min | optional `OPENSKY_CLIENT_ID/SECRET` | Anonymous 400 credits/day | ✅ 885 aircraft |
| iss | [wheretheiss.at](https://wheretheiss.at/w/developer) | 10 s | – | ~1 req/s | ✅ |
| space-weather | [NOAA SWPC](https://www.swpc.noaa.gov) Kp index + alerts | 10 min | – | – | ✅ |
| launches | [Launch Library 2](https://thespacedevs.com/llapi) upcoming | 1 h | – | Anonymous 15 req/h | ✅ 12 launches |
| markets | [FRED](https://fred.stlouisfed.org) daily closes: S&P 500, NASDAQ, Dow, Nikkei 225, Brent, WTI | 3 h | – | Public CSV | ✅ 6 series (delayed, end of day) |
| crypto | [CoinGecko](https://www.coingecko.com/en/api) simple price (BTC, ETH) | 2 min | optional `COINGECKO_DEMO_KEY` | ~5–15 calls/min public | ✅ |
| crypto-chart | CoinGecko 30-day history | 1 h | optional | same | ✅ |
| fx | [Frankfurter](https://frankfurter.dev) (ECB reference rates) | 1 h | – | – | ✅ (ECB publishes ~16:00 CET on working days) |
| geocode | [Photon](https://photon.komoot.io) (OpenStreetMap) place search | 24 h cache | – | Fair use; input debounced | ✅ |
| youtube-live | [YouTube Data API v3](https://developers.google.com/youtube/v3): current live video per channel | 30 min | `YOUTUBE_API_KEY` | 10,000 units/day; ATLAS ~50–600 | ⏸ not configured (logic unit-tested) |
| air-quality | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) (Copernicus CAMS model) | 30 min | – | < 10,000 calls/day | ✅ 2026-10-30 |
| epic | [NASA EPIC](https://epic.gsfc.nasa.gov) full-disc Earth photos (DSCOVR, L1) | 3 h | – | Public archive | ✅ 13 images (12–48 h delay) |
| on-this-day | [Wikimedia Feed API](https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day) "On this day" | 6 h | – | Wikimedia API etiquette | ⚠️ works, but HTTP 429 from the shared cloud IP during testing |
| basemap | [OpenFreeMap](https://openfreemap.org) vector tiles (© OpenStreetMap) | – | – | Free, no key | ✅; bundled Natural Earth fallback when unreachable |

## News feeds

German: tagesschau, DW (de), ZDFheute, DER SPIEGEL.
English: BBC World / Business / Technology / Science, DW (en), Al Jazeera, France 24,
The Guardian (World), NPR (World), The New York Times (World), UN News, WHO, NASA, Simple Flying.

ATLAS shows only headline, short teaser text from the feed and a link to the original
article. It does not fetch or reproduce full articles and does not bypass paywalls.

News items are placed on the map only at **country level** (approximate centroid), and only when a
country is named in the headline or teaser. ATLAS never invents precise coordinates for news.

## Live TV

Only official broadcaster channels are listed (`src/lib/channels.ts`):
tagesschau, WELT, DW Deutsch, DW News, France 24 English, Al Jazeera English, Sky News,
Euronews English, Bloomberg Television, ABC News Live, NBC News NOW, CNA, TRT World (YouTube embeds),
plus BBC News and CNBC as link-only (geo-restricted / pay-TV).

- With `YOUTUBE_API_KEY`, the server finds each channel's current live video (RSS feed + one
  `videos.list` call; `search.list` fallback cached 6 h) and embeds only videos that are
  live, public **and marked embeddable** by the broadcaster.
- Without a key, the player uses YouTube's channel-based `embed/live_stream?channel=` URL,
  which YouTube does not always honour. The official live page and the YouTube channel link
  are always shown next to the player.

## Freshness labels

| Label | Meaning |
|---|---|
| Live | Near real-time positions (aircraft, ISS), fetched within the last two refresh intervals |
| Aktuell / Recent | Fetched successfully within the expected refresh window |
| Verzögert / Delayed | Inherently delayed data (FRED closes, ECB FX rates) |
| Zwischengespeichert / Cached | Last good value served because a refresh failed, or offline copy from the service worker |
| Nicht verfügbar / Unavailable | No data (not configured, upstream down, rate-limited) |

## Not included (no free, permitted source)

DAX, FTSE, Euro Stoxx and gold prices; flight schedules / airport departures; ship positions (AIS);
real-time exchange quotes; push notifications while the app is closed.

## Computed locally (no source)

Day/night terminator, sunrise/sunset, day length, moon phase (NOAA solar equations, `src/lib/astro.ts`),
world-clock day/night icons, and the **Global activity index** – a weighted sum of current events
(quakes by magnitude, GDACS red/orange alerts, breaking stories, severe weather warnings). The formula is
shown in the app; it is an ATLAS metric, not an official risk rating.
