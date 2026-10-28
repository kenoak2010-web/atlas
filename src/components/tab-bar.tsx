"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Globe2, Map, Newspaper, Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "./ui";

const TABS = [
  { href: "/", key: "nav.overview", icon: Globe2 },
  { href: "/map", key: "nav.map", icon: Map },
  { href: "/tv", key: "nav.tv", icon: Tv },
  { href: "/news", key: "nav.news", icon: Newspaper },
  { href: "/explore", key: "nav.explore", icon: Compass },
] as const;

export function TabBar() {
  const path = usePathname();
  const { t } = useT();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-[var(--tabbar)] pb-safe pl-safe pr-safe backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto flex max-w-[640px] justify-around">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-[50px] flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium", active ? "text-accent" : "text-text-3")}
              >
                <Icon size={24} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
