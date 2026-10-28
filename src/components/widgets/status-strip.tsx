"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Database } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AtlasEvent } from "@/lib/types";
import { useNews } from "../news";

/** Count of currently tracked events with a transparent breakdown. */
export function StatusStrip() {
  const { t, lang } = useT();
  const quakes = useProvider<AtlasEvent[]>("earthquakes", { minMag: "4.5", range: "day" });
  const gdacs = useProvider<AtlasEvent[]>("gdacs");
  const de = useProvider<AtlasEvent[]>("alerts-de");
  const us = useProvider<AtlasEvent[]>("alerts-us");
  const news = useNews();
  const parts = useMemo(() => {
    const p: { label: string; n: number | null }[] = [
      { label: lang === "de" ? "Erdbeben M4.5+ (24 h)" : "Quakes M4.5+ (24 h)", n: quakes.data?.data?.length ?? null },
      { label: lang === "de" ? "GDACS-Ereignisse" : "GDACS events", n: gdacs.data?.data?.length ?? null },
      { label: lang === "de" ? "Unwetterwarnungen DE/US" : "Severe weather DE/US", n: de.data?.data || us.data?.data ? (de.data?.data?.filter((e) => e.severity >= 3).length ?? 0) + (us.data?.data?.length ?? 0) : null },
      { label: lang === "de" ? "Eilmeldungen" : "Breaking stories", n: news.data?.data ? news.clusters.filter((c) => c.breaking).length : null },
    ];
    return p;
  }, [quakes.data, gdacs.data, de.data, us.data, news.data, news.clusters, lang]);
  const known = parts.filter((p) => p.n != null);
  const total = known.reduce((s, p) => s + (p.n ?? 0), 0);
  return (
    <div className="card px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[12px] font-medium text-text-2">{t("overview.activeEvents")}</div>
          <div className="text-[30px] leading-tight font-bold tracking-tight tabular">{known.length ? total : "–"}</div>
        </div>
        <Link href="/sources" className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-surface-2 px-3 text-[12px] font-medium text-accent">
          <Database size={14} /> {t("overview.dataStatus")}
        </Link>
      </div>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] text-text-2">
        {parts.map((p) => (
          <li key={p.label} className="flex justify-between gap-2">
            <span className="truncate">{p.label}</span>
            <span className="font-semibold text-text tabular">{p.n ?? "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
