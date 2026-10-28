import { describe, expect, it } from "vitest";
import { parseYoutubeFeedIds, pickLive } from "@/server/providers/youtube";
import { embedUrl, CHANNELS } from "@/lib/channels";

describe("youtube live resolver", () => {
  it("extracts video ids from channel RSS", () => {
    const xml = `<feed><entry><yt:videoId>04BqMycb-rY</yt:videoId></entry><entry><yt:videoId>p9MsklMgvxA</yt:videoId></entry></feed>`;
    expect(parseYoutubeFeedIds(xml)).toEqual(["04BqMycb-rY", "p9MsklMgvxA"]);
  });

  it("keeps only live, embeddable, public videos of known channels", () => {
    const raw = {
      items: [
        { id: "aaaaaaaaaaa", snippet: { channelId: "C1", title: "Live A", liveBroadcastContent: "live" }, status: { embeddable: true, privacyStatus: "public" }, liveStreamingDetails: { actualStartTime: "2026-10-28T08:00:00Z", concurrentViewers: "10" } },
        { id: "bbbbbbbbbbb", snippet: { channelId: "C1", title: "Live B", liveBroadcastContent: "live" }, status: { embeddable: true, privacyStatus: "public" }, liveStreamingDetails: { concurrentViewers: "500" } },
        { id: "ccccccccccc", snippet: { channelId: "C2", title: "Not embeddable", liveBroadcastContent: "live" }, status: { embeddable: false } },
        { id: "ddddddddddd", snippet: { channelId: "C2", title: "VOD", liveBroadcastContent: "none" } },
        { id: "eeeeeeeeeee", snippet: { channelId: "X", title: "Other channel", liveBroadcastContent: "live" } },
      ],
    };
    const m = pickLive(raw, new Set(["C1", "C2"]));
    expect([...m.keys()]).toEqual(["C1"]);
    expect(m.get("C1")?.videoId).toBe("bbbbbbbbbbb");
  });

  it("embeds a resolved video id, else falls back to the channel live_stream embed", () => {
    const c = CHANNELS.find((x) => x.id === "dw-en")!;
    expect(embedUrl(c, { videoId: "04BqMycb-rY" })).toMatch(/^https:\/\/www\.youtube\.com\/embed\/04BqMycb-rY\?/);
    expect(embedUrl(c)).toContain("embed/live_stream?");
    expect(embedUrl(c, { videoId: "bad id" })).toContain("live_stream");
    expect(embedUrl(CHANNELS.find((x) => x.mode === "link")!)).toBeNull();
  });
});
