"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ComponentType } from "react";
import { useT } from "@/lib/i18n";
import { usePrefs, type WidgetId } from "@/lib/store";
import { OfflineBanner, TopActions } from "./top-bar";
import { PageHeader } from "./ui";
import { Clocks } from "./widgets/clock";
import { StatusStrip } from "./widgets/status-strip";
import { WeatherWidget } from "./widgets/weather";
import { AlertsWidget, AviationWidget, BriefWidget, MarketsWidget, MiniMapWidget, QuakesWidget, TimelineWidget, TvWidget } from "./widgets/overview-widgets";

const WIDGET_COMPONENTS: Record<WidgetId, ComponentType> = {
  brief: BriefWidget,
  map: MiniMapWidget,
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
      <div className="space-y-3 px-4">
        <Clocks />
        <StatusStrip />
        {order
          .filter((w) => !hidden.includes(w))
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
