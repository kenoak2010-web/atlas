"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight, ExternalLink, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { relativeTime } from "@/lib/format";
import type { Freshness, Severity } from "@/lib/types";
import type { ClientEnvelope } from "@/lib/api";
import { useOnline } from "@/lib/api";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** false during SSR/hydration, true afterwards – for values that depend on the client clock. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/** Re-render every `ms` so relative timestamps stay correct. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Number that counts up/down smoothly to its new value. */
export function AnimatedNumber({ value, decimals = 0, className, duration = 900 }: { value: number | null | undefined; decimals?: number; className?: string; duration?: number }) {
  const [shown, setShown] = useState<number | null>(value ?? null);
  const from = useRef<number>(0);
  const { lang } = useT();
  useEffect(() => {
    if (value == null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * eased;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  if (value == null) return <span className={className}>–</span>;
  return <span className={cn("tabular", className)}>{(shown ?? value).toLocaleString(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

/** true once the page is scrolled past `px` (for compact headers). */
export function useScrolled(px = 48): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > px);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [px]);
  return scrolled;
}

/** Blurred bar with the small page title, shown once the large title scrolls away. */
export function CompactBar({ title, show }: { title: string; show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "compact-bar fixed inset-x-0 top-0 z-30 border-b border-[var(--separator)] bg-[var(--tabbar)] pt-safe backdrop-blur-2xl backdrop-saturate-150",
        show ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
      )}
    >
      <div className="mx-auto flex h-11 max-w-[640px] items-center justify-center px-12 text-[16px] font-semibold tracking-tight">
        <span className="truncate">{title}</span>
      </div>
    </div>
  );
}

export function RelTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const { lang } = useT();
  const now = useNow();
  return (
    <time dateTime={iso ?? undefined} className={className} title={iso ? new Date(iso).toLocaleString() : undefined} suppressHydrationWarning>
      {relativeTime(iso, lang, now)}
    </time>
  );
}

const FRESH_STYLE: Record<Freshness, string> = {
  live: "bg-green/15 text-green",
  recent: "bg-blue/12 text-blue",
  delayed: "bg-orange/15 text-orange",
  cached: "bg-text-3/15 text-text-2",
  unavailable: "bg-red/12 text-red",
};

export function FreshnessPill({ freshness }: { freshness: Freshness }) {
  const { t } = useT();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", FRESH_STYLE[freshness])}>
      {freshness === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {t(`fresh.${freshness}`)}
    </span>
  );
}

/** Source + freshness + timestamp line shown under every data module. */
export function DataMeta({ env, className }: { env: ClientEnvelope<unknown> | undefined; className?: string }) {
  const { t } = useT();
  const online = useOnline();
  if (!env) return null;
  const freshness: Freshness = !online && env.data ? "cached" : env.freshness;
  const ts = env.sourceUpdatedAt ?? env.fetchedAt;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-2", className)}>
      <FreshnessPill freshness={freshness} />
      {ts && (
        <span>
          {env.sourceUpdatedAt ? t("common.updated") : t("common.fetched")} <RelTime iso={ts} />
        </span>
      )}
      <span aria-hidden>·</span>
      <a href={env.attribution.url} target={env.attribution.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {env.attribution.name}
      </a>
    </div>
  );
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cn("card overflow-hidden", className)}>{children}</As>;
}

export function CardHeader({ title, icon, href, action, subtitle }: { title: string; icon?: ReactNode; href?: string; action?: ReactNode; subtitle?: ReactNode }) {
  const inner = (
    <div className="flex items-center gap-2">
      {icon && <span className="text-text-2">{icon}</span>}
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      {href && <ChevronRight size={18} className="text-text-3" aria-hidden />}
    </div>
  );
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="inline-flex min-h-[28px] items-center">
            {inner}
          </Link>
        ) : (
          inner
        )}
        {subtitle && <div className="mt-0.5 text-[12px] text-text-2">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4 py-3" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  const { t } = useT();
  return (
    <div className={cn("flex items-start gap-3 text-[13px] text-text-2", compact ? "px-4 py-3" : "px-4 py-6")} role="alert">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-text">{t("fresh.unavailable")}</div>
        <div className="mt-0.5 break-words">{message}</div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-medium text-accent">
          <RefreshCw size={14} /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function Empty({ children, icon }: { children?: ReactNode; icon?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="fade-in flex flex-col items-center gap-2 px-4 py-7 text-center text-[13px] text-text-2">
      {icon && <span className="pop grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-3">{icon}</span>}
      <span className="max-w-[280px]">{children ?? t("common.none")}</span>
    </div>
  );
}

const SEV_COLOR: Record<number, string> = { 0: "bg-text-3", 1: "bg-blue", 2: "bg-yellow", 3: "bg-orange", 4: "bg-red" };
const SEV_TEXT: Record<number, string> = { 0: "text-text-3", 1: "text-blue", 2: "text-yellow", 3: "text-orange", 4: "text-red" };
export function SeverityDot({ severity, className, pulse }: { severity: Severity | number; className?: string; pulse?: boolean }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", SEV_COLOR[severity] ?? "bg-text-3", pulse && `ping ${SEV_TEXT[severity] ?? ""}`, className)} aria-hidden />;
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium transition-all duration-300",
        active ? "bg-accent-gradient text-white shadow-[0_6px_20px_-6px_var(--accent)]" : "border border-[var(--border)] bg-surface text-text backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1", className)}>{children}</div>;
}

/** Red "LIVE" pill with a pulsing dot. */
export function LiveBadge({ className, label = "LIVE" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-red px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-[0_0_14px_-2px_var(--color-red)]", className)}>
      <span className="ping h-1.5 w-1.5 rounded-full bg-white text-white" aria-hidden />
      {label}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string; className?: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className={cn("relative grid rounded-[11px] bg-surface-2 p-0.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-[9px] bg-surface-solid shadow-sm transition-transform duration-300 ease-[var(--ease-spring)] dark:bg-white/15"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("relative z-[1] min-h-[32px] truncate rounded-[9px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors", o.value === value ? "text-text" : "text-text-2")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", checked ? "bg-green" : "bg-text-3/40")}
    >
      <span className={cn("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-spring)]", checked ? "translate-x-[22px]" : "translate-x-[2px]")} />
    </button>
  );
}

export function ExternalButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("press bg-accent-gradient inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent)]", className)}
    >
      {children} <ExternalLink size={15} aria-hidden />
    </a>
  );
}

/** iOS-style bottom sheet. Closes on backdrop tap, Escape, or swipe down on the grabber. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { t } = useT();
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setDy(0);
      onClose();
    }, 210);
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissRef.current();
    window.addEventListener("keydown", onKey);
    // Lock page scroll behind the sheet.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className={cn("absolute inset-0 bg-black/50 backdrop-blur-[2px]", closing ? "fade-out" : "fade-in")} onClick={dismiss} aria-label={t("common.close")} />
      <div
        className={cn(closing ? "sheet-out" : "sheet-in", "relative max-h-[86dvh] w-full max-w-[640px] overflow-y-auto rounded-t-[26px] border-t border-[var(--border)] bg-surface-solid pb-safe shadow-2xl")}
        style={{ transform: dy > 0 && !closing ? `translateY(${dy}px)` : undefined, transition: !dragging && !closing ? "transform 300ms var(--ease-spring)" : undefined }}
      >
        <div
          className="sticky top-0 z-10 bg-surface-solid/95 px-4 pt-2 pb-2 backdrop-blur"
          onTouchStart={(e) => {
            startY.current = e.touches[0].clientY;
            setDragging(true);
          }}
          onTouchMove={(e) => startY.current != null && setDy(Math.max(0, e.touches[0].clientY - startY.current))}
          onTouchEnd={() => {
            setDragging(false);
            if (dy > 90) dismiss();
            else setDy(0);
            startY.current = null;
          }}
        >
          <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-text-3/50" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[17px] font-semibold">{title}</div>
            <button onClick={dismiss} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2" aria-label={t("common.close")}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  const scrolled = useScrolled(56);
  return (
    <>
    <CompactBar title={title} show={scrolled} />
    <header className="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.28em] text-accent uppercase">
          <span className="ping h-1.5 w-1.5 rounded-full bg-accent text-accent" aria-hidden />
          Atlas
        </div>
        <h1 className="text-gradient text-[34px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13px] text-text-2">{subtitle}</div>}
      </div>
      {action}
    </header>
    </>
  );
}

export function Row({ children, onClick, href, className }: { children: ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const cls = cn("flex w-full min-h-[44px] items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-surface-2", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

export function Divided({ children }: { children: ReactNode }) {
  return <div className="stagger divide-y divide-[var(--separator)]">{children}</div>;
}

/** Simple dependency-free sparkline (SVG) with a soft area fill and a draw-in animation. */
export function Sparkline({ values, className, positive }: { values: number[]; className?: string; positive?: boolean }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / range) * 28 - 1] as const);
  const pts = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const color = positive === undefined ? "var(--accent)" : positive ? "var(--green)" : "var(--red)";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 100,30`} fill={`url(#sg${id})`} className="fade-in" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1} className="draw" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
