"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Star, Volume2, VolumeX, X } from "lucide-react";
import { CHANNELS, embedUrl, youtubeLiveUrl, type Channel } from "@/lib/channels";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/store";
import { TopActions } from "./top-bar";
import { Card, Chip, ChipRow, PageHeader, cn } from "./ui";

function Player({ c, onClose }: { c: Channel; onClose: () => void }) {
  const { t } = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(false);
  const src = embedUrl(c, { autoplay: true })!;
  const cmd = (func: string) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "https://www.youtube.com");
  return (
    <Card className="mb-3">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          ref={frame}
          key={c.id}
          src={`${src}&enablejsapi=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
          title={`${c.name} live`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold">{c.name}</div>
          <div className="text-[11px] text-text-2">{t("tv.embed")} · {t("tv.notLiveHint")}</div>
        </div>
        <button
          onClick={() => {
            cmd(muted ? "unMute" : "mute");
            setMuted(!muted);
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-accent"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-text-2" aria-label={t("common.close")}>
          <X size={18} />
        </button>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 text-[14px] font-medium text-accent">
          {t("tv.official")} <ExternalLink size={14} />
        </a>
        {youtubeLiveUrl(c) && (
          <a href={youtubeLiveUrl(c)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 text-[14px] font-medium text-accent">
            YouTube <ExternalLink size={14} />
          </a>
        )}
      </div>
    </Card>
  );
}

export function TvScreen() {
  const { t } = useT();
  const favs = usePrefs((s) => s.favoriteChannels);
  const toggle = usePrefs((s) => s.toggleIn);
  const [active, setActive] = useState<Channel | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("c");
    const c = CHANNELS.find((x) => x.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link from overview widget
    if (c?.mode === "youtube") setActive(c);
  }, []);

  const list = CHANNELS.filter((c) => (!lang || c.lang === lang) && (!onlyFav || favs.includes(c.id))).sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));

  return (
    <div className="page">
      <PageHeader title={t("tv.title")} subtitle={t("tv.note")} action={<TopActions />} />
      <div className="px-4">
        {active && <Player c={active} onClose={() => setActive(null)} />}
        <ChipRow className="mb-2">
          <Chip active={onlyFav} onClick={() => setOnlyFav(!onlyFav)}><Star size={13} /> {t("tv.favorites")}</Chip>
          <Chip active={!lang} onClick={() => setLang(null)}>{t("common.all")}</Chip>
          <Chip active={lang === "de"} onClick={() => setLang(lang === "de" ? null : "de")}>Deutsch</Chip>
          <Chip active={lang === "en"} onClick={() => setLang(lang === "en" ? null : "en")}>English</Chip>
        </ChipRow>
        <div className="grid grid-cols-2 gap-3">
          {list.map((c) => {
            const fav = favs.includes(c.id);
            const playing = active?.id === c.id;
            return (
              <div key={c.id} className={cn("card flex flex-col justify-between gap-3 p-3", playing && "ring-2 ring-accent")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] leading-tight font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-text-2 uppercase">{c.lang} · {c.country}</div>
                  </div>
                  <button onClick={() => toggle("favoriteChannels", c.id)} aria-label={t("tv.favorites")} aria-pressed={fav} className={cn("-m-1 p-1", fav ? "text-yellow" : "text-text-3")}>
                    <Star size={18} fill={fav ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="text-[11px] text-text-3">{c.mode === "youtube" ? t("tv.embed") : (c.note ?? t("tv.linkOnly"))}</div>
                {c.mode === "youtube" ? (
                  <button
                    onClick={() => {
                      setActive(c);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-accent text-[14px] font-semibold text-white"
                  >
                    <Play size={15} fill="currentColor" /> {t("tv.play")}
                  </button>
                ) : (
                  <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-[14px] font-semibold text-accent">
                    {t("tv.official")} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[12px] text-text-3">
          {t("tv.notLiveHint")} Picture-in-Picture: über die Steuerung des YouTube-Players, sofern iOS es für den Stream erlaubt.
        </p>
      </div>
    </div>
  );
}
