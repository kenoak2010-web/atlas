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
  const activeIndex = TABS.findIndex(({ href }) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)));
  return (
    <nav aria-label="Hauptnavigation" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-safe pl-safe pr-safe">
      <ul className="pointer-events-auto relative mx-3 mb-2 flex max-w-[620px] justify-around rounded-[28px] border border-[var(--border)] bg-[var(--tabbar)] px-1 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto">
        {/* Sliding highlight behind the active tab */}
        {activeIndex >= 0 && (
          <li aria-hidden className="pointer-events-none absolute inset-y-0 left-1 flex items-center" style={{ width: `calc((100% - 0.5rem) / ${TABS.length})`, transform: `translateX(${activeIndex * 100}%)`, transition: "transform 420ms var(--ease-spring)" }}>
            <span className="mx-auto h-8 w-12 -translate-y-[9px] rounded-full bg-accent/15 shadow-[0_0_18px_-2px_var(--accent)]" />
          </li>
        )}
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("press flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors", active ? "text-accent" : "text-text-3")}
              >
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-transform duration-300", active && "scale-110")}>
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
