"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/** Resolved theme (after "system" preference has been applied). */
export function useDark(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
}
