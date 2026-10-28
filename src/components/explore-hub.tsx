"use client";

import Link from "next/link";
import { Activity, Bell, Bookmark, CloudSun, Database, HeartHandshake, History, Plane, Rocket, Search, Settings, TrendingUp } from "lucide-react";
import { useT, type TKey } from "@/lib/i18n";
import { TopActions } from "./top-bar";
import { PageHeader } from "./ui";

const MODULES: { href: string; key: TKey; icon: typeof Plane; color: string }[] = [
  { href: "/explore/hazards", key: "explore.hazards", icon: Activity, color: "#ff9f0a" },
  { href: "/explore/weather", key: "explore.weather", icon: CloudSun, color: "#40c8e0" },
  { href: "/explore/aviation", key: "explore.aviation", icon: Plane, color: "#5e5ce6" },
  { href: "/explore/space", key: "explore.space", icon: Rocket, color: "#bf5af2" },
  { href: "/explore/economy", key: "explore.economy", icon: TrendingUp, color: "#30d158" },
  { href: "/explore/humanitarian", key: "explore.humanitarian", icon: HeartHandshake, color: "#ff375f" },
  { href: "/timeline", key: "explore.timeline", icon: History, color: "#0a84ff" },
  { href: "/search", key: "explore.search", icon: Search, color: "#8e8e93" },
];

const UTIL: { href: string; key: TKey; icon: typeof Plane }[] = [
  { href: "/alerts", key: "explore.alerts", icon: Bell },
  { href: "/saved", key: "explore.saved", icon: Bookmark },
  { href: "/sources", key: "explore.sources", icon: Database },
  { href: "/settings", key: "explore.settings", icon: Settings },
];

export function ExploreHub() {
  const { t } = useT();
  return (
    <div className="page">
      <PageHeader title={t("explore.title")} action={<TopActions />} />
      <div className="grid grid-cols-2 gap-3 px-4">
        {MODULES.map(({ href, key, icon: Icon, color }) => (
          <Link key={href} href={href} className="card flex min-h-[96px] flex-col justify-between p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: color }}>
              <Icon size={19} />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">{t(key)}</span>
          </Link>
        ))}
      </div>
      <div className="card mx-4 mt-4 divide-y divide-[var(--separator)]">
        {UTIL.map(({ href, key, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-[48px] items-center gap-3 px-4 text-[16px]">
            <Icon size={19} className="text-text-2" /> {t(key)}
          </Link>
        ))}
      </div>
    </div>
  );
}
