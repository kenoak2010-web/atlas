"use client";

import { useSelection } from "@/lib/selection";
import { useT } from "@/lib/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import { NewsDetail } from "./news";
import { EventDetail } from "./events";
import { ExternalButton, RelTime, Sheet } from "./ui";

/** Single global bottom sheet for whatever item the user tapped (list or map). */
export function DetailSheet() {
  const { sel, select } = useSelection();
  const { t, lang } = useT();
  const close = () => select(null);
  if (!sel) return null;
  if (sel.type === "news") return <Sheet open onClose={close} title={t("nav.news")}><NewsDetail c={sel.cluster} /></Sheet>;
  if (sel.type === "event") return <Sheet open onClose={close} title={t("common.details")}><EventDetail e={sel.event} /></Sheet>;
  const a = sel.aircraft;
  const rows: [string, string][] = [
    [t("aviation.callsign"), a.callsign ?? "–"],
    ["ICAO 24", a.icao24.toUpperCase()],
    [t("aviation.origin"), a.originCountry],
    [t("aviation.altitude"), a.altitude != null ? `${formatNumber(a.altitude, lang, 0)} m (${formatNumber(a.altitude * 3.28084, lang, 0)} ft)` : "–"],
    [t("aviation.speed"), a.velocity != null ? `${formatNumber(a.velocity * 3.6, lang, 0)} km/h (${formatNumber(a.velocity * 1.94384, lang, 0)} kn)` : "–"],
    [t("aviation.heading"), a.heading != null ? `${Math.round(a.heading)}°` : "–"],
    ["Squawk", a.squawk ?? "–"],
    [lang === "de" ? "Position" : "Position", `${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`],
    [t("aviation.lastContact"), formatDateTime(a.lastContact, lang)],
  ];
  return (
    <Sheet open onClose={close} title={a.callsign ?? a.icao24.toUpperCase()}>
      <div className="space-y-4">
        <div className="text-[12px] text-text-2">
          {a.onGround ? t("aviation.onGround") : "ADS-B"} · <RelTime iso={a.lastContact} /> · OpenSky Network
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-3 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-2">{k}</dt>
              <dd className="tabular">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] text-text-2">{t("aviation.coverage")}</p>
        <ExternalButton href={`https://opensky-network.org/aircraft-profile?icao24=${encodeURIComponent(a.icao24)}`} className="w-full">OpenSky</ExternalButton>
      </div>
    </Sheet>
  );
}
