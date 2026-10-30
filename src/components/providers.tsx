"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePrefs } from "@/lib/store";
import { initNative, isNative } from "@/lib/native";
import { AlertEngine } from "./alert-engine";
import { DetailSheet } from "./detail-sheet";
import { PullToRefresh } from "./pull-to-refresh";
import { ConnectionToast } from "./connection-toast";

function ThemeSync() {
  const theme = usePrefs((s) => s.theme);
  const lang = usePrefs((s) => s.lang);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", dark ? "#04060c" : "#eef1f7");
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
    // The iOS app shows its own offline page, so the service worker is only for the PWA.
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production" || isNative()) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("SW registration failed", e));
  }, []);
  return null;
}

function NativeBridge() {
  const router = useRouter();
  useEffect(() => initNative((url) => router.push(url)), [router]);
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
      <NativeBridge />
      <AlertEngine />
      <Suspense fallback={null}>
        <DetailSheet />
      </Suspense>
      <PullToRefresh />
      <ConnectionToast />
      {children}
    </QueryClientProvider>
  );
}
