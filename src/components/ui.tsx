"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useT();
  return <div className="px-4 py-6 text-center text-[13px] text-text-2">{children ?? t("common.none")}</div>;
}

const SEV_COLOR: Record<number, string> = { 0: "bg-text-3", 1: "bg-blue", 2: "bg-yellow", 3: "bg-orange", 4: "bg-red" };
export function SeverityDot({ severity, className }: { severity: Severity | number; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", SEV_COLOR[severity] ?? "bg-text-3", className)} aria-hidden />;
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium transition-colors",
        active ? "bg-text text-bg" : "bg-surface text-text shadow-[var(--shadow)] dark:bg-surface-2",
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

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-[30px] rounded-[8px] px-3 text-[13px] font-medium transition-all", o.value === value ? "bg-surface text-text shadow-sm dark:bg-[#636366]" : "text-text-2")}
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
      <span className={cn("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-[2px]")} />
    </button>
  );
}

export function ExternalButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white", className)}
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label={t("common.close")} />
      <div
        className="sheet-in relative max-h-[86dvh] w-full max-w-[640px] overflow-y-auto rounded-t-[22px] bg-surface pb-safe shadow-2xl"
        style={{ transform: dy > 0 ? `translateY(${dy}px)` : undefined }}
      >
        <div
          className="sticky top-0 z-10 bg-surface/95 px-4 pt-2 pb-2 backdrop-blur"
          onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
          onTouchMove={(e) => startY.current != null && setDy(Math.max(0, e.touches[0].clientY - startY.current))}
          onTouchEnd={() => {
            if (dy > 90) onClose();
            setDy(0);
            startY.current = null;
          }}
        >
          <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-text-3/50" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[17px] font-semibold">{title}</div>
            <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2" aria-label={t("common.close")}>
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
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-3 pb-3">
      <div className="min-w-0">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13px] text-text-2">{subtitle}</div>}
      </div>
      {action}
    </header>
  );
}

export function Row({ children, onClick, href, className }: { children: ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const cls = cn("flex w-full min-h-[44px] items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{children}</button>;
  return <div className={cls}>{children}</div>;
}

export function Divided({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[var(--separator)]">{children}</div>;
}

/** Simple dependency-free sparkline (SVG). */
export function Sparkline({ values, className, positive }: { values: number[]; className?: string; positive?: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <polyline points={pts} fill="none" stroke={positive === undefined ? "var(--accent)" : positive ? "var(--green)" : "var(--red)"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
