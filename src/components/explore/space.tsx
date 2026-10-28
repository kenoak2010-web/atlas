"use client";

import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { SpaceWeather, UpcomingLaunch } from "@/server/providers/space";
import { useNews, NewsRow } from "../news";
import { SubPage } from "../sub-page";
import { Card, CardHeader, DataMeta, Divided, Empty, ErrorState, ListSkeleton, RelTime, cn } from "../ui";

interface Iss { lat: number; lon: number; altitudeKm: number; velocityKmh: number; visibility: string | null; time: string }

const kpColor = (kp: number) => (kp >= 7 ? "bg-red" : kp >= 5 ? "bg-orange" : kp >= 4 ? "bg-yellow" : "bg-green");

export function SpaceScreen() {
  const { t, lang } = useT();
  const iss = useProvider<Iss>("iss");
  const sw = useProvider<SpaceWeather>("space-weather");
  const launches = useProvider<UpcomingLaunch[]>("launches");
  const news = useNews();
  const spaceNews = news.clusters.filter((c) => c.topics.includes("space")).slice(0, 6);
  const kp = sw.data?.data?.kp ?? [];
  const lastKp = kp.at(-1);
  return (
    <SubPage title={t("explore.space")}>
      <Card>
        <CardHeader title={t("space.iss")} />
        {iss.data?.data ? (
          <dl className="grid grid-cols-2 gap-3 px-4 pb-2 text-[13px]">
            <div><dt className="text-text-2">{lang === "de" ? "Position" : "Position"}</dt><dd className="text-[17px] font-semibold tabular">{iss.data.data.lat.toFixed(2)}°, {iss.data.data.lon.toFixed(2)}°</dd></div>
            <div><dt className="text-text-2">{t("aviation.altitude")}</dt><dd className="text-[17px] font-semibold tabular">{formatNumber(iss.data.data.altitudeKm, lang, 0)} km</dd></div>
            <div><dt className="text-text-2">{t("aviation.speed")}</dt><dd className="text-[17px] font-semibold tabular">{formatNumber(iss.data.data.velocityKmh, lang, 0)} km/h</dd></div>
            <div><dt className="text-text-2">{lang === "de" ? "Sichtbarkeit" : "Visibility"}</dt><dd className="text-[17px] font-semibold">{iss.data.data.visibility === "daylight" ? (lang === "de" ? "Tagseite" : "Daylight") : iss.data.data.visibility === "eclipsed" ? (lang === "de" ? "Erdschatten" : "Eclipsed") : "–"}</dd></div>
          </dl>
        ) : iss.isPending ? <ListSkeleton /> : <ErrorState message={iss.data?.error ?? ""} onRetry={() => iss.refetch()} />}
        <div className="px-4 pb-1"><a href="/map" className="text-[13px] font-medium text-accent">{t("nav.map")} →</a></div>
        <DataMeta env={iss.data} className="px-4 pt-1 pb-3" />
      </Card>

      <Card>
        <CardHeader title={t("space.kp")} subtitle={lastKp ? `Kp ${lastKp.kp.toFixed(2)} · ${formatDateTime(lastKp.time, lang, { utc: true })}` : undefined} />
        {kp.length ? (
          <div className="flex h-24 items-end gap-[3px] px-4" role="img" aria-label="Kp index, last 72 hours">
            {kp.map((k) => (
              <div key={k.time} className={cn("flex-1 rounded-t-[3px]", kpColor(k.kp))} style={{ height: `${Math.max(4, (k.kp / 9) * 100)}%` }} title={`${k.time}: Kp ${k.kp}`} />
            ))}
          </div>
        ) : sw.isPending ? <ListSkeleton /> : <ErrorState message={sw.data?.error ?? ""} onRetry={() => sw.refetch()} />}
        <div className="px-4 pt-1 text-[11px] text-text-3">{lang === "de" ? "Kp ≥ 5 = geomagnetischer Sturm (NOAA G1+)" : "Kp ≥ 5 = geomagnetic storm (NOAA G1+)"}</div>
        <DataMeta env={sw.data} className="px-4 pt-1 pb-3" />
      </Card>

      <Card>
        <CardHeader title={t("space.alerts")} />
        {sw.data?.data?.alerts.length ? (
          <Divided>
            {sw.data.data.alerts.slice(0, 8).map((a) => (
              <details key={a.id} className="px-4 py-2.5">
                <summary className="cursor-pointer text-[14px] font-medium">{a.headline}<div className="text-[11px] font-normal text-text-2"><RelTime iso={a.time} /> · {a.productId}</div></summary>
                <pre className="mt-2 text-[11px] whitespace-pre-wrap text-text-2">{a.message}</pre>
              </details>
            ))}
          </Divided>
        ) : <Empty />}
        <div className="pb-2" />
      </Card>

      <Card>
        <CardHeader title={t("space.launches")} />
        {launches.data?.data ? (
          <Divided>
            {launches.data.data.map((l) => (
              <div key={l.id} className="px-4 py-2.5">
                <div className="text-[14px] font-semibold">{l.name}</div>
                <div className="text-[12px] text-text-2">
                  {t("space.net")}: {formatDateTime(l.net, lang)} (<RelTime iso={l.net} />) · {l.status}
                </div>
                <div className="text-[12px] text-text-3">{[l.provider, l.location].filter(Boolean).join(" · ")}</div>
              </div>
            ))}
          </Divided>
        ) : launches.isPending ? <ListSkeleton /> : <ErrorState message={launches.data?.error ?? ""} onRetry={() => launches.refetch()} />}
        <DataMeta env={launches.data} className="px-4 pt-2 pb-3" />
      </Card>

      <Card>
        <CardHeader title={t("topic.space")} />
        {spaceNews.length ? <Divided>{spaceNews.map((c) => <NewsRow key={c.id} c={c} compact />)}</Divided> : <Empty />}
        <div className="pb-2" />
      </Card>
    </SubPage>
  );
}
