"use client";

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "./ui";

/** Floating pill that slides in when the connection drops and briefly confirms when it is back. */
export function ConnectionToast() {
  const online = useOnline();
  const { lang } = useT();
  const [back, setBack] = useState(false);
  const was = useRef(online);
  useEffect(() => {
    if (online && !was.current) {
      setBack(true);
      const id = setTimeout(() => setBack(false), 2500);
      was.current = online;
      return () => clearTimeout(id);
    }
    was.current = online;
  }, [online]);
  if (online && !back) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className={cn("expand-in flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur-xl", online ? "bg-green/90" : "bg-black/80")}>
        {online ? <Wifi size={15} /> : <WifiOff size={15} />}
        {online ? (lang === "de" ? "Wieder online – Daten werden aktualisiert" : "Back online – refreshing data") : lang === "de" ? "Offline – zeige zwischengespeicherte Daten" : "Offline – showing cached data"}
      </div>
    </div>
  );
}
