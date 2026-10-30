"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { OfflineBanner } from "./top-bar";
import { CompactBar, useScrolled } from "./ui";

export function SubPage({ title, subtitle, children, action }: { title: string; subtitle?: ReactNode; children: ReactNode; action?: ReactNode }) {
  const router = useRouter();
  const { t } = useT();
  const scrolled = useScrolled(64);
  return (
    <div className="page">
      <CompactBar title={title} show={scrolled} />
      <div className="sticky top-0 z-40 w-fit pt-safe px-2 pt-2">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))}
          className="press inline-flex min-h-[44px] items-center gap-0.5 px-2 text-[17px] text-accent"
        >
          <ChevronLeft size={22} /> {t("common.back")}
        </button>
      </div>
      <header className="flex items-end justify-between gap-3 px-4 pb-3">
        <div className="min-w-0">
          <h1 className="text-gradient text-[32px] leading-tight font-extrabold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[13px] text-text-2">{subtitle}</div>}
        </div>
        {action}
      </header>
      <OfflineBanner />
      <div className="rise space-y-3 px-4">{children}</div>
    </div>
  );
}
