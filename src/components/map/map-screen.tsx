"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { BookmarkPlus, Globe2, Layers, LocateFixed, Loader2 } from "lucide-react";
import { useT, type TKey } from "@/lib/i18n";
import { MAP_LAYERS, usePrefs, type MapLayerId } from "@/lib/store";
import { useDark } from "@/lib/use-dark";
import { distanceKm } from "@/lib/geo";
import { AIRCRAFT_MIN_ZOOM, useMapData, type MapFilters } from "./use-map-data";
import { COLORS } from "./styles";
import { PlaceSearch } from "../place-search";
import { Chip, ChipRow, DataMeta, Segmented, Sheet, Toggle, cn } from "../ui";

const AtlasMap = dynamic(() => import("./atlas-map"), { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-none" /> });

const LAYER_COLOR: Record<MapLayerId, string> = {
  news: COLORS.news,
  quakes: COLORS.quake,
  disasters: COLORS.disaster,
  weather: COLORS.weather,
  alerts: COLORS.alert,
  wildfires: COLORS.fire,
  volcanoes: COLORS.volcano,
  humanitarian: COLORS.humanitarian,
  aircraft: COLORS.aircraft,
  iss: COLORS.iss,
};

export function MapScreen() {
  const { t, lang } = useT();
  const dark = useDark();
  const globe = usePrefs((s) => s.mapGlobe);
  const setPref = usePrefs((s) => s.set);
  const defaults = usePrefs((s) => s.mapLayers);
  const places = usePrefs((s) => s.places);
  const addPlace = usePrefs((s) => s.addPlace);
  const [visible, setVisible] = useState<MapLayerId[]>(defaults);
  const [sheet, setSheet] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [filters, setFilters] = useState<MapFilters>({ minMag: "2.5", range: "day", maxAgeH: 24, bbox: null, zoom: 1.2 });
  const [view, setView] = useState<{ center: [number, number]; zoom: number; bounds: [number, number, number, number] } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; zoom?: number; bbox?: [number, number, number, number] | null; key: number } | null>(null);
  const { data, envs, loading, aircraftEnabled } = useMapData(visible, filters);

  const toggle = (l: MapLayerId) => setVisible((v) => (v.includes(l) ? v.filter((x) => x !== l) : [...v, l]));

  const saveRegion = () => {
    if (!view) return;
    const [s, w, n] = view.bounds;
    const radius = Math.max(25, Math.min(2000, Math.round(distanceKm({ lat: s, lon: w }, { lat: n, lon: w }) / 2)));
    const name = prompt(t("map.saveRegion"), `${view.center[1].toFixed(2)}, ${view.center[0].toFixed(2)}`);
    if (name) addPlace({ name, lat: view.center[1], lon: view.center[0], radiusKm: radius });
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setFlyTo({ lat: p.coords.latitude, lon: p.coords.longitude, zoom: 8, key: Date.now() }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className="fixed inset-0 bg-bg">
      <AtlasMap
        data={data}
        visible={visible}
        dark={dark}
        globe={globe}
        flyTo={flyTo}
        onBasemapFallback={() => setFallback(true)}
        onViewChange={(v) => {
          setView(v);
          setFilters((f) => ({ ...f, bbox: v.bounds, zoom: v.zoom }));
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 pt-safe">
        <div className="pointer-events-auto mx-auto flex max-w-[640px] gap-2 px-3 pt-2">
          <div className="flex-1">
            <PlaceSearch onPick={(p) => setFlyTo({ lat: p.lat, lon: p.lon, zoom: p.countryCode && !p.bbox ? 4.5 : 9, bbox: p.bbox, key: Date.now() })} />
          </div>
        </div>
        <ChipRow className="pointer-events-auto mx-auto max-w-[640px] px-3 pt-2">
          {MAP_LAYERS.map((l) => (
            <Chip key={l} active={visible.includes(l)} onClick={() => toggle(l)}>
              <span className="h-2 w-2 rounded-full" style={{ background: LAYER_COLOR[l] }} aria-hidden />
              {t(`map.layer.${l}` as TKey)}
            </Chip>
          ))}
        </ChipRow>
        {visible.includes("aircraft") && !aircraftEnabled && (
          <div className="fade-in mx-auto mt-1 w-fit rounded-full bg-black/70 px-3 py-1 text-[12px] text-white">{t("map.zoomForAircraft")}</div>
        )}
        {fallback && <div className="fade-in mx-auto mt-1 w-fit rounded-full bg-orange/90 px-3 py-1 text-[12px] text-white">{t("map.tilesFallback")}</div>}
      </div>

      <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] flex flex-col gap-2">
        {loading && (
          <div className="pop grid h-11 w-11 place-items-center card rounded-full" aria-label={t("common.loading")}>
            <Loader2 size={18} className="animate-spin text-text-2" />
          </div>
        )}
        <button onClick={() => setPref("mapGlobe", !globe)} aria-pressed={globe} className={cn("card press grid h-11 w-11 place-items-center rounded-full", globe ? "text-white bg-accent-gradient" : "text-accent")} aria-label={lang === "de" ? "3D-Globus" : "3D globe"}>
          <Globe2 size={20} />
        </button>
        <button onClick={locate} className="grid h-11 w-11 place-items-center card press rounded-full text-accent" aria-label={t("map.locate")}>
          <LocateFixed size={20} />
        </button>
        <button onClick={saveRegion} className="grid h-11 w-11 place-items-center card press rounded-full text-accent" aria-label={t("map.saveRegion")}>
          <BookmarkPlus size={20} />
        </button>
        <button onClick={() => setSheet(true)} className="grid h-11 w-11 place-items-center card press rounded-full text-accent" aria-label={t("map.layers")}>
          <Layers size={20} />
        </button>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t("map.layers")}>
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[13px] font-semibold text-text-2">{t("map.timeRange")}</div>
            <Segmented
              className="w-full"
              value={String(filters.maxAgeH)}
              options={[
                { value: "1", label: t("time.1h") },
                { value: "6", label: t("time.6h") },
                { value: "24", label: t("time.24h") },
                { value: "168", label: t("time.7d") },
              ]}
              onChange={(v) => {
                const h = Number(v);
                setFilters((f) => ({ ...f, maxAgeH: h, range: h <= 1 ? "hour" : h <= 24 ? "day" : "week", minMag: h > 24 && (f.minMag === "all" || f.minMag === "1.0") ? "2.5" : f.minMag }));
              }}
            />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold text-text-2">{t("map.minMag")}</div>
            <Segmented
              className="w-full"
              value={filters.minMag}
              options={[
                { value: "all", label: "≥ 0" },
                { value: "2.5", label: "≥ 2.5" },
                { value: "4.5", label: "≥ 4.5" },
                { value: "significant", label: "Sig." },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, minMag: v as MapFilters["minMag"], range: v === "all" && f.range === "week" ? "day" : f.range }))}
            />
          </div>
          <ul className="divide-y divide-[var(--separator)] rounded-xl bg-surface-2">
            {MAP_LAYERS.map((l) => (
              <li key={l} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full transition-shadow duration-300" style={{ background: LAYER_COLOR[l], boxShadow: visible.includes(l) ? `0 0 10px ${LAYER_COLOR[l]}` : undefined }} aria-hidden />
                  <span className="flex-1 text-[15px]">{t(`map.layer.${l}` as TKey)}</span>
                  <Toggle checked={visible.includes(l)} onChange={() => toggle(l)} label={t(`map.layer.${l}` as TKey)} />
                </div>
                {visible.includes(l) && envs[l] && <DataMeta env={envs[l]} className="mt-1 pl-6" />}
                {visible.includes(l) && envs[l]?.error && <div className="mt-1 pl-6 text-[11px] text-red">{envs[l]?.error}</div>}
                {visible.includes(l) && envs[l]?.note && <div className="mt-0.5 pl-6 text-[11px] text-text-3">{envs[l]?.note}</div>}
                {l === "aircraft" && visible.includes(l) && <div className="mt-0.5 pl-6 text-[11px] text-text-3">Zoom ≥ {AIRCRAFT_MIN_ZOOM}</div>}
              </li>
            ))}
          </ul>
          {places.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-text-2">{t("settings.places")}</div>
              <ChipRow>
                {places.map((p) => (
                  <Chip key={p.id} onClick={() => { setFlyTo({ lat: p.lat, lon: p.lon, zoom: 6, key: Date.now() }); setSheet(false); }}>{p.name}</Chip>
                ))}
              </ChipRow>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
