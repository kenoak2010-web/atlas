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
    <nav aria-label="Hauptnavigation" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe pl-safe pr-safe">
      <ul className="pointer-events-auto mx-3 mb-2 flex max-w-[620px] justify-around rounded-[28px] border border-[var(--border)] bg-[var(--tabbar)] px-1 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("press flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors", active ? "text-accent" : "text-text-3")}
              >
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-all duration-300", active && "bg-accent/15 shadow-[0_0_18px_-2px_var(--accent)]")}>
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
