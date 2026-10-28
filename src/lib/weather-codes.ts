import type { Lang } from "./store";

/** WMO weather interpretation codes as used by Open-Meteo. */
const CODES: Record<number, [string, string, string]> = {
  0: ["Klar", "Clear sky", "☀️"],
  1: ["Überwiegend klar", "Mainly clear", "🌤️"],
  2: ["Teilweise bewölkt", "Partly cloudy", "⛅"],
  3: ["Bedeckt", "Overcast", "☁️"],
  45: ["Nebel", "Fog", "🌫️"],
  48: ["Reifnebel", "Rime fog", "🌫️"],
  51: ["Leichter Niesel", "Light drizzle", "🌦️"],
  53: ["Niesel", "Drizzle", "🌦️"],
  55: ["Starker Niesel", "Dense drizzle", "🌧️"],
  56: ["Gefrierender Niesel", "Freezing drizzle", "🌧️"],
  57: ["Starker gefrierender Niesel", "Dense freezing drizzle", "🌧️"],
  61: ["Leichter Regen", "Slight rain", "🌦️"],
  63: ["Regen", "Rain", "🌧️"],
  65: ["Starker Regen", "Heavy rain", "🌧️"],
  66: ["Gefrierender Regen", "Freezing rain", "🌧️"],
  67: ["Starker gefrierender Regen", "Heavy freezing rain", "🌧️"],
  71: ["Leichter Schneefall", "Slight snow", "🌨️"],
  73: ["Schneefall", "Snow", "🌨️"],
  75: ["Starker Schneefall", "Heavy snow", "❄️"],
  77: ["Schneegriesel", "Snow grains", "🌨️"],
  80: ["Leichte Schauer", "Light showers", "🌦️"],
  81: ["Schauer", "Showers", "🌧️"],
  82: ["Heftige Schauer", "Violent showers", "⛈️"],
  85: ["Schneeschauer", "Snow showers", "🌨️"],
  86: ["Starke Schneeschauer", "Heavy snow showers", "❄️"],
  95: ["Gewitter", "Thunderstorm", "⛈️"],
  96: ["Gewitter mit Hagel", "Thunderstorm with hail", "⛈️"],
  99: ["Schweres Gewitter mit Hagel", "Severe thunderstorm with hail", "⛈️"],
};

export function weatherLabel(code: number | null | undefined, lang: Lang): string {
  if (code == null) return "–";
  const c = CODES[code];
  return c ? (lang === "de" ? c[0] : c[1]) : `WMO ${code}`;
}

export function weatherIcon(code: number | null | undefined): string {
  if (code == null) return "·";
  return CODES[code]?.[2] ?? "·";
}
