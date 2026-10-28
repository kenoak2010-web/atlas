import type { StyleSpecification } from "maplibre-gl";

/**
 * Basemap styles. OpenFreeMap is free, needs no key and explicitly allows
 * production use (https://openfreemap.org). If it is unreachable (outage,
 * offline PWA) ATLAS falls back to a bundled 1:110m country outline map.
 */
export const BASEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export function offlineStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      countries: { type: "geojson", data: "/basemap/countries-110m.geojson", attribution: "Natural Earth" },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": dark ? "#0b0d12" : "#dfe6ee" } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": dark ? "#1c1c1e" : "#fbfbfd" } },
      { id: "borders", type: "line", source: "countries", paint: { "line-color": dark ? "#3a3a3c" : "#c7c7cc", "line-width": 0.6 } },
    ],
  };
}

export const COLORS = {
  news: "#0a84ff",
  quake: "#ff9f0a",
  quakeStrong: "#ff453a",
  disaster: "#bf5af2",
  weather: "#40c8e0",
  alert: "#ff375f",
  fire: "#ff6b00",
  volcano: "#a2845e",
  humanitarian: "#30d158",
  aircraft: "#5e5ce6",
  iss: "#ffd60a",
};
