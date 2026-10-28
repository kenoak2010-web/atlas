"use client";

import { useEffect } from "react";
import { useProvider } from "@/lib/api";
import { deriveAlerts, useAlertStore } from "@/lib/alerts";
import { usePrefs } from "@/lib/store";
import type { AtlasEvent } from "@/lib/types";
import type { NewsPayload } from "@/lib/news/types";
import type { Quote } from "@/server/providers/markets";

/** Runs in the background of the app shell and turns real data into alerts. */
export function AlertEngine() {
  const settings = usePrefs((s) => s.alerts);
  const places = usePrefs((s) => s.places);
  const on = settings.enabled;
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" }, { enabled: on });
  const news = useProvider<NewsPayload>("news", undefined, { enabled: on && settings.breakingNews });
  const de = useProvider<AtlasEvent[]>("alerts-de", undefined, { enabled: on && settings.weather });
  const us = useProvider<AtlasEvent[]>("alerts-us", undefined, { enabled: on && settings.weather });
  const gdacs = useProvider<AtlasEvent[]>("gdacs", undefined, { enabled: on && (settings.disasters || settings.savedRegions) });
  const crypto = useProvider<Quote[]>("crypto", undefined, { enabled: on && settings.marketMovePct > 0 });
  const ingest = useAlertStore((s) => s.ingest);

  useEffect(() => {
    if (!on) return;
    const candidates = deriveAlerts(
      {
        quakes: quakes.data?.data ?? undefined,
        news: news.data?.data?.clusters,
        weather: [...(de.data?.data ?? []), ...(us.data?.data ?? [])],
        disasters: gdacs.data?.data ?? undefined,
        markets: crypto.data?.data ?? undefined,
        places,
      },
      settings,
    );
    const fresh = ingest(candidates);
    if (!settings.notify || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Notify only about events from the last hour to avoid a burst on first launch.
    const notifiable = fresh.filter((f) => Date.now() - Date.parse(f.time) < 3600_000 && f.severity >= 2).slice(0, 3);
    if (!notifiable.length) return;
    navigator.serviceWorker?.ready
      .then((reg) => notifiable.forEach((n) => reg.showNotification(n.title, { body: n.body, tag: n.id, data: { url: n.url ?? "/alerts" }, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" })))
      .catch(() => undefined);
  }, [on, settings, places, quakes.data, news.data, de.data, us.data, gdacs.data, crypto.data, ingest]);

  return null;
}
