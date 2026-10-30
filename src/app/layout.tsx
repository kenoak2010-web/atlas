import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Providers } from "@/components/providers";
import { TabBar } from "@/components/tab-bar";

export const metadata: Metadata = {
  title: { default: "ATLAS", template: "%s · ATLAS" },
  description: "ATLAS – Global Intelligence Center: Nachrichten, Erdbeben, Wetter, Karte und Live-TV aus offiziellen Quellen.",
  applicationName: "ATLAS",
  appleWebApp: { capable: true, title: "ATLAS", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/favicon.png", sizes: "32x32" }, { url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f7" },
    { media: "(prefers-color-scheme: dark)", color: "#04060c" },
  ],
};

// Applies the stored theme before first paint to avoid a light/dark flash.
const THEME_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("atlas-prefs")||"{}").state||{};var t=p.theme||"dark";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";if(p.lang)document.documentElement.lang=p.lang}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <main className="pt-safe pl-safe pr-safe mx-auto min-h-dvh max-w-[640px]">{children}</main>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
