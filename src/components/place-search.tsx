"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/news/geotag";
import type { Place } from "@/server/providers/geocode";

export interface PickedPlace {
  name: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
  countryCode?: string | null;
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

export function matchCountries(q: string, lang: "de" | "en") {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return COUNTRIES.filter((c) => c.de.toLowerCase().startsWith(s) || c.en.toLowerCase().startsWith(s) || c.iso2.toLowerCase() === s || c.iso3.toLowerCase() === s)
    .slice(0, 5)
    .map((c) => ({ ...c, label: lang === "de" ? c.de : c.en }));
}

/** Country search (offline list) + place search (Photon geocoder, debounced). */
export function PlaceSearch({ onPick, placeholder }: { onPick: (p: PickedPlace) => void; placeholder?: string }) {
  const { t, lang } = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q.trim(), 450);
  const countries = useMemo(() => matchCountries(q, lang), [q, lang]);
  const places = useProvider<Place[]>("geocode", { q: dq, lang }, { enabled: open && dq.length >= 3 });
  const pick = (p: PickedPlace) => {
    onPick(p);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-xl bg-surface/95 px-3 shadow-[var(--shadow)] backdrop-blur dark:bg-surface-2/95 transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_var(--accent)]">
        <Search size={17} className="text-text-2" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t("map.searchPlace")}
          aria-label={placeholder ?? t("map.searchPlace")}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-3"
          enterKeyHint="search"
          autoComplete="off"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label={t("common.close")} className="text-text-3">
            <X size={17} />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-12 z-30 max-h-[50dvh] overflow-y-auto rounded-xl bg-surface shadow-2xl">
          {countries.map((c) => (
            <button key={c.iso2} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-surface-2" onClick={() => pick({ name: c.label, lat: c.lat, lon: c.lon, bbox: null, countryCode: c.iso2 })}>
              <span className="text-[20px]">{c.flag}</span>
              <span className="text-[15px]">{c.label}</span>
              <span className="ml-auto text-[12px] text-text-3">{t("search.countries")}</span>
            </button>
          ))}
          {places.isFetching && <div className="px-3 py-2 text-[13px] text-text-2">{t("common.loading")}</div>}
          {places.data?.error && !places.data.data && <div className="px-3 py-2 text-[13px] text-text-2">{places.data.error}</div>}
          {(places.data?.data ?? []).map((p, i) => (
            <button key={`${p.lat},${p.lon},${i}`} className="flex w-full flex-col px-3 py-2.5 text-left active:bg-surface-2" onClick={() => pick({ name: p.name, lat: p.lat, lon: p.lon, bbox: p.bbox, countryCode: p.countryCode })}>
              <span className="text-[15px]">{p.name}</span>
              <span className="text-[12px] text-text-2">{p.detail}</span>
            </button>
          ))}
          {places.data?.data && <div className="px-3 py-1.5 text-[10px] text-text-3">{places.data.attribution.name}</div>}
        </div>
      )}
    </div>
  );
}
