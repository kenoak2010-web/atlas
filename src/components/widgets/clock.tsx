"use client";

import { useT } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { useNow } from "../ui";

export function Clocks() {
  const { t, lang } = useT();
  const now = new Date(useNow(1000));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="grid grid-cols-2 gap-3" suppressHydrationWarning>
      <div className="card px-4 py-3">
        <div className="text-[12px] font-medium text-text-2">{t("time.utc")}</div>
        <div className="text-[26px] font-semibold tracking-tight tabular" suppressHydrationWarning>{formatTime(now, lang, "UTC")}</div>
      </div>
      <div className="card px-4 py-3">
        <div className="truncate text-[12px] font-medium text-text-2" suppressHydrationWarning>{t("time.local")} · {tz.split("/").pop()?.replace("_", " ")}</div>
        <div className="text-[26px] font-semibold tracking-tight tabular" suppressHydrationWarning>{formatTime(now, lang)}</div>
      </div>
    </div>
  );
}
