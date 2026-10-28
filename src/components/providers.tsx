"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { usePrefs } from "@/lib/store";
import { AlertEngine } from "./alert-engine";
import { DetailSheet } from "./detail-sheet";

function ThemeSync() {
  const theme = usePrefs((s) => s.theme);
  const lang = usePrefs((s) => s.lang);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", dark ? "#000000" : "#f5f5f7");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("SW registration failed", e));
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: true, refetchIntervalInBackground: false, gcTime: 30 * 60_000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeSync />
      <ServiceWorker />
      <AlertEngine />
      <DetailSheet />
      {children}
    </QueryClientProvider>
  );
}
