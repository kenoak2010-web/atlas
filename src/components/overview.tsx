"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ComponentType } from "react";
import { useT } from "@/lib/i18n";
import { usePrefs, type WidgetId } from "@/lib/store";
import { OfflineBanner, TopActions } from "./top-bar";
import { PageHeader } from "./ui";
import dynamic from "next/dynamic";
import { BriefingWidget, HotspotsWidget } from "./widgets/intel-widgets";
import { ActivityWidget, EarthWidget, HistoryWidget, NewsTicker, SkyWidget, WorldClocks } from "./widgets/extra-widgets";
import { WeatherWidget } from "./widgets/weather";
import { AlertsWidget, AviationWidget, BriefWidget, MarketsWidget, QuakesWidget, TimelineWidget, TvWidget } from "./widgets/overview-widgets";

const GlobeHero = dynamic(() => import("./widgets/globe-hero").then((m) => m.GlobeHero), { ssr: false, loading: () => <div className="card skeleton h-[300px]" /> });

// "map" is rendered as the globe hero at the top, so it is not part of the stack.
const WIDGET_COMPONENTS: Record<Exclude<WidgetId, "map">, ComponentType> = {
  briefing: BriefingWidget,
  brief: BriefWidget,
  hotspots: HotspotsWidget,
  activity: ActivityWidget,
  sky: SkyWidget,
  earth: EarthWidget,
  history: HistoryWidget,
  quakes: QuakesWidget,
  weather: WeatherWidget,
  alerts: AlertsWidget,
  aviation: AviationWidget,
  markets: MarketsWidget,
  tv: TvWidget,
  timeline: TimelineWidget,
};

export function Overview() {
  const { t, lang } = useT();
  const order = usePrefs((s) => s.widgetOrder);
  const hidden = usePrefs((s) => s.hiddenWidgets);
  const today = new Date().toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="page">
      <PageHeader title={t("overview.title")} subtitle={<span suppressHydrationWarning>{today}</span>} action={<TopActions />} />
      <OfflineBanner />
      <div className="rise space-y-3 px-4">
        {!hidden.includes("map") && <GlobeHero />}
        <NewsTicker />
        <WorldClocks />
        {order
          .filter((w): w is Exclude<WidgetId, "map"> => w !== "map" && !hidden.includes(w) && w in WIDGET_COMPONENTS)
          .map((w) => {
            const W = WIDGET_COMPONENTS[w];
            return <W key={w} />;
          })}
        <Link href="/settings#widgets" className="flex min-h-[44px] items-center justify-center gap-2 text-[14px] font-medium text-accent">
          <SlidersHorizontal size={16} /> {t("overview.customize")}
        </Link>
      </div>
    </div>
  );
}
