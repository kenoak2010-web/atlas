"use client";

import Link from "next/link";
import { Bell, Search, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAlertStore } from "@/lib/alerts";

/** Floating actions (search, alerts) + offline banner shown at the top of scrollable pages. */
export function TopActions() {
  const unread = useAlertStore((s) => s.items.filter((i) => !i.read).length);
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      <Link href="/search" aria-label={t("common.search")} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-text shadow-[var(--shadow)] dark:bg-surface-2">
        <Search size={18} />
      </Link>
      <Link href="/alerts" aria-label={t("alerts.title")} className="relative grid h-9 w-9 place-items-center rounded-full bg-surface text-text shadow-[var(--shadow)] dark:bg-surface-2">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-red px-1 text-center text-[11px] leading-[18px] font-bold text-white tabular">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useT();
  if (online) return null;
  return (
    <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-orange/15 px-3 py-2 text-[13px] text-orange" role="status">
      <WifiOff size={16} /> {t("offline.banner")}
    </div>
  );
}
