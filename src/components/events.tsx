"use client";

import { useT, type TKey } from "@/lib/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AtlasEvent } from "@/lib/types";
import { useSelection } from "@/lib/selection";
import { ExternalButton, RelTime, SeverityDot, cn } from "./ui";
import dynamic from "next/dynamic";

const MiniLocator = dynamic(() => import("./map/mini-locator"), { ssr: false, loading: () => <div className="skeleton h-[180px] w-full rounded-2xl" /> });

const MAG_STYLE = (mag: number) =>
  mag >= 7
    ? "from-[#ff4d5e] to-[#c2123b] text-white shadow-[0_6px_18px_-6px_#ff4d5e]"
    : mag >= 6
      ? "from-[#ff9f0a] to-[#e2541b] text-white shadow-[0_6px_18px_-6px_#ff9f0a]"
      : mag >= 5
        ? "from-[#ffd60a] to-[#f5a400] text-black"
        : mag >= 4
          ? "from-[#6b7186] to-[#454a5c] text-white"
          : "from-[#4a4f60] to-[#33374a] text-white/90";

export function MagBadge({ mag }: { mag: number }) {
  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[15px] font-bold tabular", MAG_STYLE(mag))}>
      {mag.toFixed(1)}
    </span>
  );
}

export function EventRow({ e, showCategory }: { e: AtlasEvent; showCategory?: boolean }) {
  const select = useSelection((s) => s.select);
  const { t } = useT();
  const mag = e.category === "earthquake" && typeof e.meta?.magnitude === "number" ? e.meta.magnitude : null;
  return (
    <button onClick={() => select({ type: "event", event: e })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-surface-2">
      {mag != null ? <MagBadge mag={mag} /> : <SeverityDot severity={e.severity} className="ml-1 h-2.5 w-2.5" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{mag != null ? (e.locationName ?? e.title) : e.title}</div>
        <div className="truncate text-[12px] text-text-2">
          {showCategory && <>{t(`cat.${e.category}` as TKey)} · </>}
          <RelTime iso={e.updatedAt ?? e.time} />
          {mag != null && e.meta?.depthKm != null && <> · {e.meta.depthKm} km</>}
          {mag == null && e.locationName && <> · {e.locationName}</>}
          {" · "}
          {e.source.name}
        </div>
      </div>
    </button>
  );
}

function precisionKey(p?: string): TKey {
  return p === "exact" ? "common.exactLocation" : p === "area" ? "common.areaLocation" : "common.approxLocation";
}

export function EventDetail({ e }: { e: AtlasEvent }) {
  const { t, lang } = useT();
  const m = e.meta ?? {};
  const rows: [string, string][] = [];
  if (e.category === "earthquake") {
    rows.push([t("quake.magnitude"), `${formatNumber(Number(m.magnitude), lang, 1)} ${m.magType ?? ""}`]);
    rows.push([t("quake.depth"), `${formatNumber(Number(m.depthKm), lang, 1)} km`]);
    if (m.tsunami) rows.push([t("quake.tsunami"), "✓"]);
    if (m.alert) rows.push(["PAGER", String(m.alert)]);
    if (m.status) rows.push(["Status", String(m.status)]);
  }
  if (m.alertLevel) rows.push(["GDACS", String(m.alertLevel)]);
  if (m.severityText) rows.push([lang === "de" ? "Schwere" : "Severity", String(m.severityText)]);
  if (m.level) rows.push([lang === "de" ? "Warnstufe" : "Level", String(m.level)]);
  if (m.districts && Number(m.districts) > 1) rows.push([lang === "de" ? "Kreise" : "Districts", String(m.districts)]);
  if (m.ends || m.expires) rows.push([lang === "de" ? "Gültig bis" : "Valid until", formatDateTime(String(m.ends ?? m.expires), lang)]);
  if (m.eonetCategory) rows.push([lang === "de" ? "Kategorie" : "Category", String(m.eonetCategory)]);
  if (m.magnitude != null && e.category !== "earthquake" && m.magnitudeUnit) rows.push([lang === "de" ? "Größe" : "Size", `${m.magnitude} ${m.magnitudeUnit}`]);
  if (m.report) rows.push([lang === "de" ? "Bericht" : "Report", String(m.report)]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-text-2">
        <SeverityDot severity={e.severity} />
        <span>{t(`cat.${e.category}` as TKey)}</span>
        <span aria-hidden>·</span>
        <RelTime iso={e.time} />
      </div>
      <h3 className="text-[20px] leading-snug font-bold tracking-tight">{e.title}</h3>
      {e.point && <MiniLocator lat={e.point.lat} lon={e.point.lon} precision={e.point.precision} color={e.severity >= 4 ? "#ff4d5e" : e.severity >= 3 ? "#ff9f0a" : "#3d9bff"} />}
      {e.description && <p className="text-[15px] leading-relaxed text-text-2">{e.description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-3 text-[14px]">
        {e.locationName && (
          <>
            <dt className="text-text-2">{lang === "de" ? "Ort" : "Location"}</dt>
            <dd>{e.locationName}</dd>
          </>
        )}
        {e.point && (
          <>
            <dt className="text-text-2">{lang === "de" ? "Koordinaten" : "Coordinates"}</dt>
            <dd className="tabular">
              {e.point.lat.toFixed(3)}, {e.point.lon.toFixed(3)}
              <div className="text-[11px] text-text-3">{t(precisionKey(e.point.precision))}</div>
            </dd>
          </>
        )}
        <dt className="text-text-2">{lang === "de" ? "Zeit" : "Time"}</dt>
        <dd className="tabular">
          {formatDateTime(e.time, lang)}
          <div className="text-[11px] text-text-3">{formatDateTime(e.time, lang, { utc: true })}</div>
        </dd>
        {e.updatedAt && e.updatedAt !== e.time && (
          <>
            <dt className="text-text-2">{t("common.updated")}</dt>
            <dd className="tabular">{formatDateTime(e.updatedAt, lang)}</dd>
          </>
        )}
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-text-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="text-text-2">{t("common.source")}</dt>
        <dd>{e.source.url ? <a className="text-accent" href={e.source.url} target="_blank" rel="noopener noreferrer">{e.source.name}</a> : e.source.name}</dd>
      </dl>
      {e.url && <ExternalButton href={e.url} className="w-full">{e.category === "earthquake" ? t("quake.officialDetails") : t("common.details")}</ExternalButton>}
    </div>
  );
}
