"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Languages, MoonStar, RefreshCw, Trash2 } from "lucide-react";
import { useT, type TKey } from "@/lib/i18n";
import { MAP_LAYERS, usePrefs, type RefreshMode, type ThemePref } from "@/lib/store";
import type { Topic } from "@/lib/news/types";
import { COUNTRIES } from "@/lib/news/geotag";
import { PlaceSearch } from "./place-search";
import { SubPage } from "./sub-page";
import { Card, CardHeader, Chip, ChipRow, Divided, Segmented, Toggle } from "./ui";

const TOPICS: Topic[] = ["protest_de", "politics", "conflict", "economy", "technology", "science", "aviation", "space", "environment", "disaster", "health"];

function Line({ label, icon, children, stack }: { label: string; icon?: React.ReactNode; children: React.ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? "space-y-2 px-4 py-3" : "flex min-h-[50px] items-center justify-between gap-3 px-4 py-2"}>
      <span className="flex items-center gap-2.5 text-[15px]">
        {icon && <span className="bg-accent-gradient grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white">{icon}</span>}
        {label}
      </span>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { t, lang } = useT();
  const p = usePrefs();
  const [countryQ, setCountryQ] = useState("");
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const countryMatches = countryQ.length >= 2 ? COUNTRIES.filter((c) => c.de.toLowerCase().includes(countryQ.toLowerCase()) || c.en.toLowerCase().includes(countryQ.toLowerCase())).slice(0, 6) : [];

  const enableNotify = async (on: boolean) => {
    if (!on) return p.setAlerts({ notify: false });
    if (typeof Notification === "undefined") {
      setNotifMsg(lang === "de" ? "Dieser Browser unterstützt keine Benachrichtigungen. Auf dem iPhone: zuerst zum Home-Bildschirm hinzufügen." : "Notifications are not supported here. On iPhone: add to Home Screen first.");
      return;
    }
    const perm = await Notification.requestPermission();
    p.setAlerts({ notify: perm === "granted" });
    setNotifMsg(perm === "granted" ? null : lang === "de" ? "Berechtigung nicht erteilt." : "Permission not granted.");
  };

  return (
    <SubPage title={t("settings.title")}>
      <Card>
        <Divided>
          <Line label={t("settings.language")} icon={<Languages size={15} />}>
            <Segmented value={p.lang} onChange={(v) => p.set("lang", v)} options={[{ value: "de", label: "Deutsch" }, { value: "en", label: "English" }]} />
          </Line>
          <Line label={t("settings.appearance")} icon={<MoonStar size={15} />} stack>
            <Segmented<ThemePref> className="w-full" value={p.theme} onChange={(v) => p.set("theme", v)} options={[{ value: "system", label: t("settings.system") }, { value: "light", label: t("settings.light") }, { value: "dark", label: t("settings.dark") }]} />
          </Line>
          <Line label={t("settings.refresh")} icon={<RefreshCw size={15} />} stack>
            <Segmented<RefreshMode> className="w-full" value={p.refresh} onChange={(v) => p.set("refresh", v)} options={[{ value: "normal", label: t("settings.refresh.normal") }, { value: "saver", label: t("settings.refresh.saver") }, { value: "manual", label: t("settings.refresh.manual") }]} />
          </Line>
        </Divided>
      </Card>

      <Card>
        <div id="widgets" className="scroll-mt-4" />
        <CardHeader title={t("settings.widgets")} subtitle={lang === "de" ? `${p.widgetOrder.length - p.hiddenWidgets.length} von ${p.widgetOrder.length} sichtbar` : `${p.widgetOrder.length - p.hiddenWidgets.length} of ${p.widgetOrder.length} visible`} />
        <Divided>
          {p.widgetOrder.map((w, i) => {
            const hidden = p.hiddenWidgets.includes(w);
            return (
              <div key={w} className="flex min-h-[50px] items-center gap-1 pr-2 pl-4 transition-opacity duration-300" style={{ opacity: hidden ? 0.55 : 1 }}>
                <span className="w-6 text-[12px] font-bold text-text-3 tabular">{i + 1}</span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${hidden ? "text-text-3 line-through decoration-text-3/50" : ""}`}>{t(`widget.${w}` as TKey)}</span>
                <button onClick={() => p.moveWidget(w, -1)} disabled={i === 0} className="press grid h-9 w-9 place-items-center rounded-full text-accent disabled:opacity-30" aria-label={lang === "de" ? "Nach oben" : "Move up"}><ArrowUp size={17} /></button>
                <button onClick={() => p.moveWidget(w, 1)} disabled={i === p.widgetOrder.length - 1} className="press grid h-9 w-9 place-items-center rounded-full text-accent disabled:opacity-30" aria-label={lang === "de" ? "Nach unten" : "Move down"}><ArrowDown size={17} /></button>
                <button onClick={() => p.toggleIn("hiddenWidgets", w)} className={`press grid h-9 w-9 place-items-center rounded-full ${hidden ? "text-text-3" : "bg-accent/12 text-accent"}`} aria-label={hidden ? (lang === "de" ? "Anzeigen" : "Show") : (lang === "de" ? "Ausblenden" : "Hide")} aria-pressed={!hidden}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            );
          })}
        </Divided>
      </Card>

      <Card>
        <CardHeader title={t("settings.interests")} subtitle={lang === "de" ? "Erhöht die Rangfolge passender Meldungen (+10 Punkte, sichtbar unter „Warum hier?“)." : "Boosts matching stories (+10 points, visible under “Why here?”)."} />
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {TOPICS.map((tp) => <Chip key={tp} active={p.topics.includes(tp)} onClick={() => p.toggleIn("topics", tp)}>{t(`topic.${tp}` as TKey)}</Chip>)}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.countries")} />
        <div className="px-4 pb-2">
          <input value={countryQ} onChange={(e) => setCountryQ(e.target.value)} placeholder={t("search.countries")} aria-label={t("search.countries")} className="h-10 w-full rounded-xl bg-surface-2 px-3 text-[16px] outline-none transition-shadow duration-200 focus:shadow-[0_0_0_2px_var(--accent)]" />
          {countryMatches.length > 0 && (
            <ChipRow className="pt-2">
              {countryMatches.map((c) => <Chip key={c.iso2} active={p.countries.includes(c.iso2)} onClick={() => p.toggleIn("countries", c.iso2)}>{c.flag} {lang === "de" ? c.de : c.en}</Chip>)}
            </ChipRow>
          )}
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {p.countries.map((c) => {
            const k = COUNTRIES.find((x) => x.iso2 === c);
            return <Chip key={c} active onClick={() => p.toggleIn("countries", c)}>{k?.flag} {lang === "de" ? k?.de : k?.en} ✕</Chip>;
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.layers")} />
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {MAP_LAYERS.map((l) => <Chip key={l} active={p.mapLayers.includes(l)} onClick={() => p.toggleIn("mapLayers", l)}>{t(`map.layer.${l}` as TKey)}</Chip>)}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.places")} subtitle={lang === "de" ? "Für Wetter und regionale Warnungen (Radius)." : "Used for weather and regional alerts (radius)."} />
        <div className="px-4 pb-2">
          <PlaceSearch onPick={(pl) => p.addPlace({ name: pl.name, lat: pl.lat, lon: pl.lon, radiusKm: 300 })} />
        </div>
        <Divided>
          {p.places.map((pl) => (
            <div key={pl.id} className="flex min-h-[48px] items-center gap-2 px-4">
              <span className="flex-1 truncate text-[15px]">{pl.name}</span>
              <select value={pl.radiusKm} onChange={(e) => p.set("places", p.places.map((x) => (x.id === pl.id ? { ...x, radiusKm: Number(e.target.value) } : x)))} className="rounded-lg bg-surface-2 px-2 py-1 text-[14px]" aria-label="Radius">
                {[50, 100, 300, 500, 1000].map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
              <button onClick={() => p.removePlace(pl.id)} className="p-2 text-text-3" aria-label={t("common.remove")}><Trash2 size={16} /></button>
            </div>
          ))}
        </Divided>
        <div className="pb-2" />
      </Card>

      <Card>
        <div id="alerts" className="scroll-mt-4" />
        <CardHeader title={t("settings.alerts")} />
        <Divided>
          <Line label={t("settings.alerts.enabled")}><Toggle checked={p.alerts.enabled} onChange={(v) => p.setAlerts({ enabled: v })} label={t("settings.alerts.enabled")} /></Line>
          <Line label={t("settings.alerts.notify")}><Toggle checked={p.alerts.notify} onChange={enableNotify} label={t("settings.alerts.notify")} /></Line>
          <Line label={t("settings.alerts.quake")}>
            <select value={p.alerts.quakeMinMag} onChange={(e) => p.setAlerts({ quakeMinMag: Number(e.target.value) })} className="rounded-lg bg-surface-2 px-2 py-1 text-[15px]" aria-label={t("settings.alerts.quake")}>
              {[4.5, 5, 5.5, 6, 6.5, 7].map((m) => <option key={m} value={m}>M {m}</option>)}
            </select>
          </Line>
          <Line label={t("settings.alerts.news")}><Toggle checked={p.alerts.breakingNews} onChange={(v) => p.setAlerts({ breakingNews: v })} label={t("settings.alerts.news")} /></Line>
          <Line label={t("settings.alerts.weather")}><Toggle checked={p.alerts.weather} onChange={(v) => p.setAlerts({ weather: v })} label={t("settings.alerts.weather")} /></Line>
          <Line label={t("settings.alerts.disasters")}><Toggle checked={p.alerts.disasters} onChange={(v) => p.setAlerts({ disasters: v })} label={t("settings.alerts.disasters")} /></Line>
          <Line label={t("settings.alerts.regions")}><Toggle checked={p.alerts.savedRegions} onChange={(v) => p.setAlerts({ savedRegions: v })} label={t("settings.alerts.regions")} /></Line>
          <Line label={t("settings.alerts.market")}>
            <select value={p.alerts.marketMovePct} onChange={(e) => p.setAlerts({ marketMovePct: Number(e.target.value) })} className="rounded-lg bg-surface-2 px-2 py-1 text-[15px]" aria-label={t("settings.alerts.market")}>
              {[0, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m === 0 ? "Aus" : `±${m} %`}</option>)}
            </select>
          </Line>
        </Divided>
        <p className="px-4 pt-2 pb-4 text-[12px] text-text-3">{t("settings.pushNote")}</p>
        {notifMsg && <p className="px-4 pb-4 text-[12px] text-red">{notifMsg}</p>}
      </Card>

      <Card>
        <CardHeader title={t("settings.install")} />
        <p className="px-4 pb-4 text-[14px] text-text-2">{t("settings.installSteps")}</p>
      </Card>

      <Card>
        <CardHeader title={t("settings.about")} />
        <p className="px-4 pb-4 text-[13px] text-text-2">
          {lang === "de"
            ? "ATLAS speichert Einstellungen nur lokal auf diesem Gerät (localStorage). Es gibt kein Konto und kein Tracking. Standort wird nur nach ausdrücklicher Zustimmung und nur für Wetter/Karte verwendet."
            : "ATLAS stores settings only on this device (localStorage). No account, no tracking. Location is only used after explicit permission, for weather/map."}
        </p>
      </Card>

      <button onClick={() => confirm(t("settings.reset") + "?") && p.reset()} className="mx-auto flex min-h-[44px] items-center text-[15px] text-red">{t("settings.reset")}</button>
    </SubPage>
  );
}
