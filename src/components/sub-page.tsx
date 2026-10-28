"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { OfflineBanner } from "./top-bar";

export function SubPage({ title, subtitle, children, action }: { title: string; subtitle?: ReactNode; children: ReactNode; action?: ReactNode }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="page">
      <div className="px-2 pt-2">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/explore"))}
          className="inline-flex min-h-[44px] items-center gap-0.5 px-2 text-[17px] text-accent"
        >
          <ChevronLeft size={22} /> {t("common.back")}
        </button>
      </div>
      <header className="flex items-end justify-between gap-3 px-4 pb-3">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[13px] text-text-2">{subtitle}</div>}
        </div>
        {action}
      </header>
      <OfflineBanner />
      <div className="space-y-3 px-4">{children}</div>
    </div>
  );
}
