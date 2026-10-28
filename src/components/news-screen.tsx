"use client";

import { useMemo, useState } from "react";
import { Globe2, Search } from "lucide-react";
import { useProvider } from "@/lib/api";
import { useT, type TKey } from "@/lib/i18n";
import type { Region, Topic } from "@/lib/news/types";
import type { GdeltArticle } from "@/server/providers/news";
import { useNews, NewsRow } from "./news";
import { OfflineBanner, TopActions } from "./top-bar";
import { Card, Chip, ChipRow, DataMeta, Divided, Empty, ErrorState, ListSkeleton, PageHeader, RelTime, Segmented } from "./ui";

const TOPICS: Topic[] = ["politics", "conflict", "economy", "technology", "science", "aviation", "space", "environment", "disaster", "health"];
const REGIONS: Region[] = ["europe", "americas", "asia", "africa", "oceania"];
const PAGE = 30;

export function NewsScreen() {
  const { t } = useT();
  const q = useNews();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [lang, setLang] = useState<"all" | "de" | "en">("all");
  const [term, setTerm] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [gdelt, setGdelt] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = term.trim().toLowerCase();
    return q.clusters.filter(
      (c) =>
        (!topic || c.topics.includes(topic)) &&
        (!region || c.regions.includes(region)) &&
        (lang === "all" || c.articles.some((a) => a.lang === lang)) &&
        (!s || c.articles.some((a) => a.title.toLowerCase().includes(s) || a.summary.toLowerCase().includes(s))),
    );
  }, [q.clusters, topic, region, lang, term]);

  const feeds = q.data?.data?.feeds ?? [];
  const failed = feeds.filter((f) => !f.ok);

  return (
    <div className="page">
      <PageHeader title={t("news.title")} action={<TopActions />} />
      <OfflineBanner />
      <div className="space-y-2 px-4">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={16} className="text-text-2" aria-hidden />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && term.trim().length >= 3 && setGdelt(term.trim())}
            placeholder={t("news.search")}
            aria-label={t("news.search")}
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-3"
            enterKeyHint="search"
          />
        </div>
        {term.trim().length >= 3 && (
          <button onClick={() => setGdelt(term.trim())} className="inline-flex min-h-[32px] items-center gap-1.5 text-[13px] font-medium text-accent">
            <Globe2 size={14} /> {t("news.worldwideSearch")}: „{term.trim()}“
          </button>
        )}
        <ChipRow>
          <Chip active={!topic} onClick={() => setTopic(null)}>{t("common.all")}</Chip>
          {TOPICS.map((tp) => (
            <Chip key={tp} active={topic === tp} onClick={() => setTopic(topic === tp ? null : tp)}>{t(`topic.${tp}` as TKey)}</Chip>
          ))}
        </ChipRow>
        <ChipRow>
          {REGIONS.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(region === r ? null : r)}>{t(`region.${r}` as TKey)}</Chip>
          ))}
        </ChipRow>
        <div className="flex items-center justify-between py-1">
          <Segmented value={lang} onChange={setLang} label={t("news.lang")} options={[{ value: "all", label: t("common.all") }, { value: "de", label: "DE" }, { value: "en", label: "EN" }]} />
          <span className="text-[12px] text-text-2 tabular">{filtered.length}</span>
        </div>
      </div>

      {gdelt && <GdeltResults q={gdelt} onClose={() => setGdelt(null)} />}

      <div className="mt-2 px-4">
        <Card>
          {q.isPending ? (
            <ListSkeleton rows={6} />
          ) : !q.data?.data ? (
            <ErrorState message={q.data?.error ?? q.error?.message ?? ""} onRetry={() => q.refetch()} />
          ) : filtered.length ? (
            <Divided>
              {filtered.slice(0, limit).map((c) => (
                <NewsRow key={c.id} c={c} />
              ))}
            </Divided>
          ) : (
            <Empty />
          )}
          {filtered.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="w-full border-t hairline py-3 text-[15px] font-medium text-accent">
              {t("common.more")} ({filtered.length - limit})
            </button>
          )}
          <DataMeta env={q.data} className="px-4 pt-2 pb-3" />
        </Card>
        {feeds.length > 0 && (
          <details className="mt-3 rounded-xl px-1 text-[12px] text-text-2">
            <summary className="cursor-pointer py-2">
              {t("news.feedStatus")}: {feeds.length - failed.length}/{feeds.length} OK
            </summary>
            <ul className="space-y-0.5 pb-2">
              {feeds.map((f) => (
                <li key={f.id} className="flex justify-between gap-2">
                  <span>{f.ok ? "✓" : "✕"} {f.name} <span className="text-text-3">({f.id})</span></span>
                  <span className="truncate text-right">{f.ok ? f.count : f.error}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function GdeltResults({ q, onClose }: { q: string; onClose: () => void }) {
  const { t } = useT();
  const r = useProvider<GdeltArticle[]>("gdelt", { q, timespan: "24h" });
  return (
    <div className="mt-2 px-4">
      <Card>
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="text-[15px] font-semibold">GDELT · „{q}“</div>
          <button onClick={onClose} className="text-[13px] text-accent">{t("common.close")}</button>
        </div>
        {r.isPending ? <ListSkeleton /> : r.data?.data ? (
          r.data.data.length ? (
            <Divided>
              {r.data.data.slice(0, 25).map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5">
                  <div className="text-[12px] text-text-2">{a.domain} · <RelTime iso={a.seenAt} /> · {a.language}</div>
                  <div className="text-[14px] leading-snug">{a.title}</div>
                </a>
              ))}
            </Divided>
          ) : <Empty />
        ) : <ErrorState message={r.data?.error ?? r.error?.message ?? ""} onRetry={() => r.refetch()} />}
        <DataMeta env={r.data} className="px-4 pt-1 pb-3" />
      </Card>
    </div>
  );
}
