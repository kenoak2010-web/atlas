/**
 * Live TV channel registry. Only official broadcaster sources.
 *
 * mode "youtube": the broadcaster runs its own 24/7 live stream on its official
 * YouTube channel. When the server resolved the current live video id
 * (youtube-live provider, needs YOUTUBE_API_KEY) ATLAS embeds that video;
 * otherwise it falls back to YouTube's channel-based live_stream embed.
 * Embedding permission is decided by the broadcaster per video (YouTube shows a
 * notice if not). The official link is always offered too.
 *
 * mode "link": no free embeddable stream (geo-restricted, pay-TV, or not on
 * YouTube) → ATLAS only links to the broadcaster's official live page.
 */
export interface Channel {
  id: string;
  name: string;
  lang: "de" | "en" | "fr" | "ar" | "multi";
  country: string;
  mode: "youtube" | "link";
  youtubeChannelId?: string;
  officialUrl: string;
  note?: string;
}

export const CHANNELS: Channel[] = [
  { id: "tagesschau24", name: "tagesschau", lang: "de", country: "DE", mode: "youtube", youtubeChannelId: "UC5NOEUbkLheQcaaRldYW5GA", officialUrl: "https://www.tagesschau.de/multimedia/livestreams" },
  { id: "welt", name: "WELT Nachrichtensender", lang: "de", country: "DE", mode: "youtube", youtubeChannelId: "UCZMsvbAhhRblVGXmEXW8TSA", officialUrl: "https://www.welt.de/mediathek/" },
  { id: "dw-de", name: "DW Deutsch", lang: "de", country: "DE", mode: "youtube", youtubeChannelId: "UCMIgOXM2JEQ2Pv2d0_PVfcg", officialUrl: "https://www.dw.com/de/live-tv/channel-deutsch" },
  { id: "dw-en", name: "DW News", lang: "en", country: "DE", mode: "youtube", youtubeChannelId: "UCknLrEdhRCp1aegoMqRaCZg", officialUrl: "https://www.dw.com/en/live-tv/channel-english" },
  { id: "france24-en", name: "France 24 English", lang: "en", country: "FR", mode: "youtube", youtubeChannelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg", officialUrl: "https://www.france24.com/en/live" },
  { id: "aljazeera-en", name: "Al Jazeera English", lang: "en", country: "QA", mode: "youtube", youtubeChannelId: "UCNye-wNBqNL5ZzHSJj3l8Bg", officialUrl: "https://www.aljazeera.com/live/" },
  { id: "sky-news", name: "Sky News", lang: "en", country: "GB", mode: "youtube", youtubeChannelId: "UCoMdktPbSTixAyNGwb-UYkQ", officialUrl: "https://news.sky.com/watch-live" },
  { id: "euronews-en", name: "Euronews English", lang: "en", country: "EU", mode: "youtube", youtubeChannelId: "UCSrZ3UV4jOidv8ppoVuvW9Q", officialUrl: "https://www.euronews.com/live" },
  { id: "bloomberg", name: "Bloomberg Television", lang: "en", country: "US", mode: "youtube", youtubeChannelId: "UCIALMKvObZNtJ6AmdCLP7Lg", officialUrl: "https://www.bloomberg.com/live" },
  { id: "abc-news", name: "ABC News Live", lang: "en", country: "US", mode: "youtube", youtubeChannelId: "UCBi2mrWuNuyYy4gbM6fW9qQ", officialUrl: "https://abcnews.go.com/Live" },
  { id: "nbc-news", name: "NBC News NOW", lang: "en", country: "US", mode: "youtube", youtubeChannelId: "UCeY0bbntWzzVIaj2z3QigXg", officialUrl: "https://www.nbcnews.com/now" },
  { id: "cna", name: "CNA", lang: "en", country: "SG", mode: "youtube", youtubeChannelId: "UC83jt4dlz1Gjl58fzQrrKZg", officialUrl: "https://www.channelnewsasia.com/watch" },
  { id: "trt-world", name: "TRT World", lang: "en", country: "TR", mode: "youtube", youtubeChannelId: "UC7fWeaHhqgM4Ry-RMpM2YYw", officialUrl: "https://www.trtworld.com/live" },
  { id: "bbc-news", name: "BBC News", lang: "en", country: "GB", mode: "link", officialUrl: "https://www.bbc.co.uk/iplayer/live/bbcnews", note: "BBC iPlayer: nur im Vereinigten Königreich / UK only" },
  { id: "cnbc", name: "CNBC", lang: "en", country: "US", mode: "link", officialUrl: "https://www.cnbc.com/live-tv/", note: "TV-Anbieter-Login erforderlich / requires TV provider login" },
];

export function embedUrl(c: Channel, opts: { autoplay?: boolean; mute?: boolean; videoId?: string | null } = {}): string | null {
  if (c.mode !== "youtube" || !c.youtubeChannelId) return null;
  const p = new URLSearchParams({
    autoplay: opts.autoplay ? "1" : "0",
    mute: opts.mute ? "1" : "0",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (opts.videoId && /^[\w-]{11}$/.test(opts.videoId)) return `https://www.youtube.com/embed/${opts.videoId}?${p.toString()}`;
  p.set("channel", c.youtubeChannelId);
  return `https://www.youtube.com/embed/live_stream?${p.toString()}`;
}

export function youtubeLiveUrl(c: Channel): string | null {
  return c.youtubeChannelId ? `https://www.youtube.com/channel/${c.youtubeChannelId}/live` : null;
}
