"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

/**
 * Pull-to-refresh for the installed PWA (iOS standalone mode has none).
 * Pull down at the top of a page to refetch every active data source.
 * Disabled on the map, where vertical drags pan the map.
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const path = usePathname();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (path.startsWith("/map")) return;
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (window.scrollY > 0 || busy || target?.closest("[role=dialog], [data-no-ptr], iframe, .no-scrollbar")) return;
      start.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Rubber-band resistance.
      pullRef.current = Math.min(120, dy * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (start.current == null) return;
      start.current = null;
      if (pullRef.current >= THRESHOLD) {
        setBusy(true);
        setPull(THRESHOLD);
        qc.refetchQueries({ type: "active" }).finally(() => {
          setBusy(false);
          setPull(0);
        });
      } else setPull(0);
      pullRef.current = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [path, qc, busy]);

  if (!pull && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-safe" aria-live="polite">
      <div
        className="card mt-2 grid h-10 w-10 place-items-center rounded-full text-accent"
        style={{ transform: `translateY(${Math.min(pull, THRESHOLD) - 20}px)`, opacity: Math.min(1, pull / 40) }}
      >
        <RefreshCw size={18} className={busy ? "animate-spin" : ""} style={busy ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: ready ? 1 : 0.6 }} />
        <span className="sr-only">{busy ? "Aktualisiere…" : ""}</span>
      </div>
    </div>
  );
}
