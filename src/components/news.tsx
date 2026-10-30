"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, ChevronRight, Share } from "lucide-react";
import { useMemo, useState } from "react";
import { useProvider } from "@/lib/api";
import { useT, type TKey } from "@/lib/i18n";
import { applyInterests } from "@/lib/news/score";
import type { NewsCluster, NewsPayload } from "@/lib/news/types";
import { COUNTRY_BY_ISO2 } from "@/lib/news/geotag";
import { usePrefs } from "@/lib/store";
import { useSelection } from "@/lib/selection";
import { ExternalButton, RelTime, cn } from "./ui";

export function useNews() {
  const q = useProvider<NewsPayload>("news");
  const topics = usePrefs((s) => s.topics);
  const countries = usePrefs((s) => s.countries);
  const clusters = useMemo(() => {
    const c = q.data?.data?.clusters ?? [];
    return topics.length || countries.length ? applyInterests(c, { topics, countries }) : c;
  }, [q.data, topics, countries]);
  return { ...q, clusters };
}

export function NewsLabel({ c }: { c: NewsCluster }) {
  const { t } = useT();
  if (c.breaking) return <span className="rounded-[5px] bg-red px-1.5 py-[1px] text-[10px] font-bold tracking-wide text-white uppercase">{t("overview.breaking")}</span>;
  return null;
}

/** Feed-provided teaser image. Hidden if it fails to load (hotlink protection, offline). */
export function NewsImage({ src, className }: { src: string | null | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote publisher image from the RSS feed
    <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn("bg-surface-2 object-cover", className)} />
  );
}

/** Large lead-story card with image and gradient overlay. */
export function NewsHero({ c }: { c: NewsCluster }) {
  const select = useSelection((s) => s.select);
  const country = c.countries[0] ? COUNTRY_BY_ISO2.get(c.countries[0]) : undefined;
  return (
    <button onClick={() => select({ type: "news", cluster: c })} className="press relative block w-full overflow-hidden rounded-[18px] bg-surface-2 text-left">
      <NewsImage src={c.image} className="aspect-[16/10] w-full" />
      {!c.image && <div className="bg-accent-gradient aspect-[16/10] w-full opacity-40" aria-hidden />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="mb-1.5 flex items-center gap-2 text-[12px] text-white/80">
          <NewsLabel c={c} />
          <span className="font-semibold text-white">{c.articles[0].sourceName}</span>
          {c.sourceCount > 1 && <span>+{c.sourceCount - 1}</span>}
          <span aria-hidden>·</span>
          <RelTime iso={c.lastUpdated} />
          {country && <span className="ml-auto">{country.flag}</span>}
        </div>
        <div className="text-[20px] leading-tight font-bold tracking-tight [text-wrap:balance]">{c.title}</div>
      </div>
    </button>
  );
}

export function NewsRow({ c, compact }: { c: NewsCluster; compact?: boolean }) {
  const { t } = useT();
  const select = useSelection((s) => s.select);
  const country = c.countries[0] ? COUNTRY_BY_ISO2.get(c.countries[0]) : undefined;
  return (
    <button onClick={() => select({ type: "news", cluster: c })} className="flex w-full gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] whitespace-nowrap text-text-2">
        <span className="shrink-0"><NewsLabel c={c} /></span>
        <span className="min-w-0 truncate font-medium">{c.articles[0].sourceName}</span>
        {c.sourceCount > 1 && <span className="shrink-0">+{c.sourceCount - 1}</span>}
        <span aria-hidden>·</span>
        <RelTime iso={c.lastUpdated} className="shrink-0" />
        {country && <span className="ml-auto shrink-0">{country.flag}</span>}
      </div>
      <div className={cn("font-semibold tracking-tight", compact ? "text-[15px] leading-snug" : "text-[16px] leading-snug")}>{c.title}</div>
      {!compact && c.summary && <div className="line-clamp-2 text-[13px] text-text-2">{c.summary}</div>}
      {!compact && c.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {c.topics.slice(0, 3).map((tp) => (
            <span key={tp} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">{t(`topic.${tp}` as TKey)}</span>
          ))}
        </div>
      )}
      </div>
      <NewsImage src={c.image} className={cn("shrink-0 rounded-xl", compact ? "h-16 w-16" : "h-20 w-20")} />
    </button>
  );
}

export function NewsDetail({ c }: { c: NewsCluster }) {
  const { t, lang } = useT();
  const bookmarks = usePrefs((s) => s.bookmarks);
  const toggle = usePrefs((s) => s.toggleBookmark);
  const saved = bookmarks.some((b) => b.id === c.id);
  const countries = c.countries.map((k) => COUNTRY_BY_ISO2.get(k)).filter(Boolean);
  const share = () => navigator.share?.({ title: c.title, url: c.url }).catch(() => undefined);
  return (
    <div className="space-y-4">
      <NewsImage src={c.image} className="aspect-[16/9] w-full rounded-2xl" />
      <div className="flex items-center gap-2 text-[12px] text-text-2">
        <NewsLabel c={c} />
        <RelTime iso={c.lastUpdated} />
        <span aria-hidden>·</span>
        <span>{t("news.sourcesCount", { n: c.sourceCount })}</span>
      </div>
      <h3 className="text-[20px] leading-snug font-bold tracking-tight">{c.title}</h3>
      {c.summary && <p className="text-[15px] leading-relaxed text-text-2">{c.summary}</p>}
      {countries.length > 0 && (
        <div className="text-[13px] text-text-2">
          <div className="flex flex-wrap gap-1.5">
            {countries.map((k) => (
              <Link key={k!.iso2} href={`/country?c=${k!.iso2}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-text">
                {k!.flag} {lang === "de" ? k!.de : k!.en} <ChevronRight size={13} className="text-text-3" />
              </Link>
            ))}
          </div>
          <div className="text-[11px] text-text-3">{t("common.approxLocation")}</div>
        </div>
      )}
      <div className="flex gap-2">
        <ExternalButton href={c.url} className="flex-1">{t("common.openOriginal")}</ExternalButton>
        <button
          onClick={() => toggle({ id: c.id, title: c.title, url: c.url, source: c.articles[0].sourceName, time: c.lastUpdated })}
          className="grid h-[44px] w-[44px] place-items-center rounded-xl bg-surface-2 text-accent"
          aria-label={saved ? t("common.bookmarked") : t("common.bookmark")}
        >
          {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button onClick={share} className="grid h-[44px] w-[44px] place-items-center rounded-xl bg-surface-2 text-accent" aria-label={t("common.share")}>
            <Share size={20} />
          </button>
        )}
      </div>
      <div>
        <div className="mb-1 text-[13px] font-semibold text-text-2 uppercase">{t("news.coverage")}</div>
        <ul className="divide-y divide-[var(--separator)] rounded-xl bg-surface-2">
          {c.articles.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block px-3 py-2.5">
                <div className="text-[12px] text-text-2">
                  <span className="font-semibold text-text">{a.sourceName}</span> · <RelTime iso={a.publishedAt} /> · {a.lang.toUpperCase()}
                </div>
                <div className="text-[14px] leading-snug">{a.title}</div>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <details className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
        <summary className="cursor-pointer font-medium">{t("common.why")} · {c.score.total}</summary>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 tabular text-text-2">
          <dt>{t("score.severity")}</dt><dd>{c.score.severity}</dd>
          <dt>{t("score.sources")}</dt><dd>{c.score.sources}</dd>
          <dt>{t("score.recency")}</dt><dd>{c.score.recency}</dd>
          <dt>{t("score.reliability")}</dt><dd>{c.score.reliability}</dd>
          <dt>{t("score.interest")}</dt><dd>{c.score.interest}</dd>
        </dl>
        <p className="mt-2 text-[11px] text-text-3">{t("score.disclaimer")}</p>
      </details>
    </div>
  );
}
