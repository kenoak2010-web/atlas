import "server-only";
import type { Provider } from "./provider";
import { usgsProvider } from "./providers/usgs";
import { weatherProvider, worldWeatherProvider } from "./providers/openmeteo";
import { newsProvider, gdeltProvider } from "./providers/news";
import { gdacsProvider, eonetProvider, firmsProvider, gvpProvider, hansProvider, nwsProvider, dwdProvider } from "./providers/hazards";
import { openskyProvider } from "./providers/aviation";
import { issProvider, spaceWeatherProvider, launchesProvider } from "./providers/space";
import { cryptoProvider, cryptoChartProvider, fxProvider, fredProvider } from "./providers/markets";
import { reliefwebProvider } from "./providers/humanitarian";
import { geocodeProvider } from "./providers/geocode";
import { youtubeLiveProvider } from "./providers/youtube";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = Provider<any, any>;

export const PROVIDERS: AnyProvider[] = [
  newsProvider,
  gdeltProvider,
  usgsProvider,
  weatherProvider,
  worldWeatherProvider,
  dwdProvider,
  nwsProvider,
  gdacsProvider,
  eonetProvider,
  firmsProvider,
  gvpProvider,
  hansProvider,
  reliefwebProvider,
  openskyProvider,
  issProvider,
  spaceWeatherProvider,
  launchesProvider,
  fredProvider,
  cryptoProvider,
  cryptoChartProvider,
  fxProvider,
  geocodeProvider,
  youtubeLiveProvider,
];

export const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));
