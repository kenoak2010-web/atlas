import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app loads the live ATLAS deployment (it needs the /api routes), so data and UI
// updates ship through Vercel without a new App Store release. `native-shell/` is only the
// offline fallback that iOS shows when the server can't be reached.
const server = process.env.ATLAS_APP_URL ?? "https://atlas-mp5l.vercel.app";

const config: CapacitorConfig = {
  appId: process.env.ATLAS_APP_ID ?? "io.github.kenoak2010.atlas",
  appName: "ATLAS",
  webDir: "native-shell",
  server: {
    url: server,
    errorPath: "offline.html",
    allowNavigation: [new URL(server).host],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#04060c",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, backgroundColor: "#04060c", showSpinner: false },
    StatusBar: { style: "DARK", overlaysWebView: true },
    LocalNotifications: { iconColor: "#0a84ff" },
  },
};

export default config;
