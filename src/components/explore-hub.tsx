"use client";

import Link from "next/link";
import { Activity, Bell, Flag, Bookmark, CloudSun, Database, HeartHandshake, History, Plane, Rocket, Search, Settings, TrendingUp } from "lucide-react";
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
  { href: "/country", key: "explore.countries", icon: Flag, color: "#ff6b3d" },
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
      <div className="rise grid grid-cols-2 gap-3 px-4">
        {MODULES.map(({ href, key, icon: Icon, color }) => (
          <Link key={href} href={href} className="card press flex min-h-[104px] flex-col justify-between overflow-hidden p-4">
            <span className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ background: color }} aria-hidden />
            <span className="relative grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, boxShadow: `0 8px 22px -8px ${color}` }}>
              <Icon size={19} />
            </span>
            <span className="relative text-[16px] font-semibold tracking-tight">{t(key)}</span>
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
