// Bridges to iOS features when ATLAS runs inside the Capacitor app. In a normal browser
// (the PWA) every helper falls back to the web API, and the Capacitor plugins are never
// loaded, because the imports are dynamic and only happen behind isNative().

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export type NativeNotice = { id: string; title: string; body: string; url?: string };

/** Turns an alert id into the 32-bit integer that iOS notifications need. */
export function noticeId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** Whether notifications can be shown at all here (native app or a browser with the API). */
export function canNotify(): boolean {
  return isNative() || typeof Notification !== "undefined";
}

export async function notifyPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (isNative()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { display } = await LocalNotifications.checkPermissions();
    return display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt";
  }
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission === "default" ? "prompt" : Notification.permission;
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (isNative()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  }
  if (typeof Notification === "undefined") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Shows alerts as system notifications: native ones in the app, service worker ones on the web. */
export async function showNotices(list: NativeNotice[]): Promise<void> {
  if (!list.length) return;
  if (isNative()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: list.map((n) => ({ id: noticeId(n.id), title: n.title, body: n.body, extra: { url: n.url ?? "/alerts" } })),
    });
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.ready;
  list.forEach((n) => reg?.showNotification(n.title, { body: n.body, tag: n.id, data: { url: n.url ?? "/alerts" }, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" }));
}

/** Opens the iOS share sheet, or the Web Share API in the browser. */
export async function shareLink(data: { title: string; url: string }): Promise<void> {
  try {
    if (isNative()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: data.title, url: data.url, dialogTitle: data.title });
      return;
    }
    await navigator.share?.(data);
  } catch {
    // Cancelled by the user, or not supported.
  }
}

/** A light tap on the Taptic Engine. Does nothing outside the app. */
export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: style === "heavy" ? ImpactStyle.Heavy : style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light }))
    .catch(() => undefined);
}

export type Position = { lat: number; lon: number };

/** Current position via iOS location services in the app, or the browser API on the web. */
export async function currentPosition(opts: { highAccuracy?: boolean; timeout?: number; maximumAge?: number } = {}): Promise<Position> {
  const { highAccuracy = false, timeout = 10_000, maximumAge = 600_000 } = opts;
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: highAccuracy, timeout, maximumAge });
    return { lat: p.coords.latitude, lon: p.coords.longitude };
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) throw new Error("Geolocation not supported");
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    ),
  );
}

/**
 * One-time setup inside the app: status bar colour that follows the theme, opening the right
 * page when a notification is tapped. Links to other sites open in Safari on their own,
 * because the app only allows navigation within the ATLAS host (capacitor.config.ts).
 * Returns a cleanup function.
 */
export function initNative(navigate: (url: string) => void): () => void {
  if (!isNative()) return () => undefined;
  const cleanups: Array<() => void> = [];
  let stopped = false;

  import("@capacitor/local-notifications")
    .then(({ LocalNotifications }) =>
      LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
        const url = (e.notification.extra as { url?: string } | undefined)?.url;
        if (url) navigate(url);
      }),
    )
    .then((h) => {
      if (stopped) void h.remove();
      else cleanups.push(() => void h.remove());
    })
    .catch(() => undefined);

  // Status bar text colour follows the light/dark theme.
  const syncBar = () =>
    import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: document.documentElement.dataset.theme === "light" ? Style.Light : Style.Dark }))
      .catch(() => undefined);
  syncBar();
  const mo = new MutationObserver(syncBar);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  cleanups.push(() => mo.disconnect());

  document.documentElement.classList.add("native-app");

  return () => {
    stopped = true;
    cleanups.forEach((c) => c());
  };
}
