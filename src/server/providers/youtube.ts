import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson, fetchText, UpstreamError } from "../http";
import { CHANNELS } from "@/lib/channels";

/**
 * Resolves the *current* live video of each official broadcaster channel so the
 * player can embed `youtube.com/embed/{videoId}` (the channel-based
 * `embed/live_stream?channel=` URL is unreliable).
 *
 * Quota-friendly: candidate ids come from each channel's public RSS feed, then a
 * single `videos.list` call (1 unit) checks which are live AND embeddable.
 * Channels whose 24/7 stream is not among the latest RSS entries fall back to
 * `search.list` (100 units), cached separately for 6 hours.
 */

export interface LiveVideo {
  channelId: string;
  videoId: string;
  title: string;
  startedAt: string | null;
  viewers: number | null;
}

const API = "https://www.googleapis.com/youtube/v3";
const SEARCH_TTL_MS = 6 * 3600_000;
const searchCache = new Map<string, { at: number; ids: string[] }>();

const VideosResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ channelId: z.string(), title: z.string(), liveBroadcastContent: z.string().optional() }),
        status: z.object({ embeddable: z.boolean().optional(), privacyStatus: z.string().optional() }).optional(),
        liveStreamingDetails: z
          .object({ actualStartTime: z.string().optional(), actualEndTime: z.string().optional(), concurrentViewers: z.string().optional() })
          .optional(),
      }),
    )
    .default([]),
});

const SearchResponse = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string().optional() }) })).default([]),
});

export function parseYoutubeFeedIds(xml: string): string[] {
  return [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map((m) => m[1]);
}

/** Picks one live, embeddable, public video per channel (most viewers wins). */
export function pickLive(raw: unknown, channelIds: Set<string>): Map<string, LiveVideo> {
  const out = new Map<string, LiveVideo>();
  for (const v of VideosResponse.parse(raw).items) {
    if (!channelIds.has(v.snippet.channelId)) continue;
    if (v.snippet.liveBroadcastContent !== "live") continue;
    if (v.liveStreamingDetails?.actualEndTime) continue;
    if (v.status?.embeddable === false || (v.status?.privacyStatus && v.status.privacyStatus !== "public")) continue;
    const viewers = v.liveStreamingDetails?.concurrentViewers ? Number(v.liveStreamingDetails.concurrentViewers) : null;
    const prev = out.get(v.snippet.channelId);
    if (prev && (prev.viewers ?? 0) >= (viewers ?? 0)) continue;
    out.set(v.snippet.channelId, {
      channelId: v.snippet.channelId,
      videoId: v.id,
      title: v.snippet.title,
      startedAt: v.liveStreamingDetails?.actualStartTime ?? null,
      viewers,
    });
  }
  return out;
}

async function videosList(ids: string[], key: string, signal?: AbortSignal): Promise<unknown> {
  const items: unknown[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const url = `${API}/videos?${new URLSearchParams({ part: "snippet,status,liveStreamingDetails", id: ids.slice(i, i + 50).join(","), key })}`;
    const r = (await fetchJson(url, { signal })) as { items?: unknown[] };
    items.push(...(r.items ?? []));
  }
  return { items };
}

export const youtubeLiveProvider = defineProvider({
  id: "youtube-live",
  label: "Live TV stream resolver (YouTube Data API)",
  category: "tv",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: { name: "YouTube", url: "https://developers.google.com/youtube/v3" },
  rateLimit: "Free quota 10,000 units/day; ATLAS uses ~50–600/day.",
  requiresKey: "YOUTUBE_API_KEY",
  note: "Finds the current live video of each official broadcaster channel. Embedding is still decided by the broadcaster.",
  params: z.object({}),
  cacheKey: () => "all",
  async fetch(_p, ctx) {
    const key = ctx.env.YOUTUBE_API_KEY!;
    const channels = CHANNELS.filter((c) => c.mode === "youtube" && c.youtubeChannelId).map((c) => c.youtubeChannelId!);
    const channelSet = new Set(channels);

    const feeds = await Promise.allSettled(
      channels.map((id) => fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { signal: ctx.signal }).then(parseYoutubeFeedIds)),
    );
    const candidates = new Set<string>();
    feeds.forEach((f) => f.status === "fulfilled" && f.value.forEach((id) => candidates.add(id)));
    for (const c of searchCache.values()) c.ids.forEach((id) => candidates.add(id));

    let live = candidates.size ? pickLive(await videosList([...candidates], key, ctx.signal), channelSet) : new Map<string, LiveVideo>();

    // search.list fallback for channels still unresolved (cached 6h per channel).
    const now = Date.now();
    const missing = channels.filter((id) => !live.has(id) && (searchCache.get(id)?.at ?? 0) < now - SEARCH_TTL_MS);
    if (missing.length) {
      const found: string[] = [];
      for (const id of missing) {
        try {
          const url = `${API}/search?${new URLSearchParams({ part: "id", channelId: id, eventType: "live", type: "video", maxResults: "3", key })}`;
          const ids = SearchResponse.parse(await fetchJson(url, { signal: ctx.signal })).items.flatMap((i) => (i.id.videoId ? [i.id.videoId] : []));
          searchCache.set(id, { at: now, ids });
          found.push(...ids);
        } catch (err) {
          if (err instanceof UpstreamError && err.status === 403) throw new UpstreamError("YouTube API quota exhausted or key rejected (HTTP 403)", 403);
        }
      }
      if (found.length) {
        const extra = pickLive(await videosList(found, key, ctx.signal), channelSet);
        live = new Map([...live, ...extra]);
      }
    }

    const data = Object.fromEntries(live);
    return { data, sourceUpdatedAt: new Date().toISOString() };
  },
});
