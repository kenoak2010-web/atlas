# Deploying ATLAS (free tier)

ATLAS is a standard Next.js 16 app with server routes, so it needs a host that runs Node.js
server functions. The recommended free option is **Vercel Hobby**.

## 1. Put the code on GitHub

1. Create an empty repository on github.com (e.g. `atlas`).
2. In the project folder:
   ```bash
   git remote add origin https://github.com/<you>/atlas.git
   git push -u origin main
   ```

## 2. Deploy on Vercel

1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import the repository.
2. Framework preset: *Next.js* (detected). Build command `npm run build`, output default.
3. **Environment Variables**: add whichever optional keys you have (see `.env.example`).
   Set `ATLAS_USER_AGENT` to something with a contact address, e.g. `ATLAS/1.0 (you@example.com)`.
4. Deploy. The URL looks like `https://atlas-<you>.vercel.app`.

Notes:
- The in-memory cache is per server instance. API responses also carry
  `Cache-Control: s-maxage=…, stale-while-revalidate=…`, so Vercel's CDN shares results
  between users and keeps upstream traffic low.
- The data route sets `maxDuration = 60` because the slowest sources (GDACS, FRED) use
  25–30 s upstream timeouts.
- Vercel Hobby is for personal, non-commercial use, which matches the terms of several data
  sources (Open-Meteo, OpenSky).

### Alternative hosts

Any Node 20+ host works: `npm ci && npm run build && npm start` (port 3000, or `-p $PORT`).
Netlify and Cloudflare (via OpenNext) also run Next.js, but are not tested.

## 3. Install on iPhone (PWA)

1. Open the deployed URL in **Safari** on the iPhone.
2. Tap the **Share** button → **Zum Home-Bildschirm** (Add to Home Screen) → **Hinzufügen**.
3. Start ATLAS from the new icon. It opens full-screen without Safari's address bar,
   in light or dark mode following the system (or your choice in Einstellungen).

What works as an installed app:
- Offline: previously opened screens and the last loaded data are shown, labelled
  "Zwischengespeichert", and an offline banner appears.
- Notifications (iOS 16.4+): only for the installed Home Screen app, after you enable
  them in Einstellungen → Warnungen. They fire **only while ATLAS is open**; there is
  no background push.
- Location: only used if you tap "Standort verwenden" (weather) or "Mein Standort" (map); otherwise use place search.

## 4. Updating

Push to `main`; Vercel redeploys automatically. The service worker picks up the new version on
the next app start (pages are network-first, so content is never stuck on an old build).
