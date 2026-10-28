import { z } from "zod";
import { defineProvider } from "../provider";
import { fetchJson } from "../http";
import type { AtlasEvent } from "@/lib/types";
import { safeUrl } from "@/lib/text";

const Disaster = z.object({
  id: z.union([z.string(), z.number()]),
  fields: z.object({
    name: z.string(),
    status: z.string().optional(),
    url: z.string().optional(),
    date: z.object({ created: z.string().optional(), event: z.string().optional() }).partial().optional(),
    country: z
      .array(z.object({ name: z.string(), iso3: z.string().optional(), location: z.object({ lat: z.number(), lon: z.number() }).optional() }))
      .optional(),
    type: z.array(z.object({ name: z.string() })).optional(),
    glide: z.string().optional(),
  }),
});

export function normalizeReliefweb(rows: z.infer<typeof Disaster>[]): AtlasEvent[] {
  return rows.flatMap((r) => {
    const f = r.fields;
    const time = f.date?.event ?? f.date?.created;
    if (!time) return [];
    const c = f.country?.[0];
    return [
      {
        id: `reliefweb:${r.id}`,
        category: "humanitarian" as const,
        title: f.name,
        description: f.type?.map((t) => t.name).join(", "),
        locationName: f.country?.map((x) => x.name).join(", "),
        point: c?.location ? { lat: c.location.lat, lon: c.location.lon, precision: "country" as const } : undefined,
        source: { name: "ReliefWeb (UN OCHA)", url: "https://reliefweb.int" },
        time: new Date(time).toISOString(),
        severity: f.status === "alert" ? 2 : 1,
        url: safeUrl(f.url) ?? `https://reliefweb.int/disaster/${r.id}`,
        meta: { status: f.status ?? null, glide: f.glide ?? null },
      },
    ];
  });
}

export const reliefwebProvider = defineProvider({
  id: "humanitarian",
  label: "ReliefWeb – current disasters",
  category: "humanitarian",
  refreshSeconds: 1800,
  freshnessClass: "periodic",
  attribution: { name: "ReliefWeb / UN OCHA", url: "https://reliefweb.int", license: "Content from various sources; see each report" },
  rateLimit: "Requires a pre-approved appname; 1,000 calls/day.",
  requiresKey: "RELIEFWEB_APPNAME",
  note: "Humanitarian situations tracked by OCHA; locations are country-level.",
  params: z.object({}),
  cacheKey: () => "disasters",
  async fetch(_p, ctx) {
    const url = new URL("https://api.reliefweb.int/v2/disasters");
    url.search = new URLSearchParams({ appname: ctx.env.RELIEFWEB_APPNAME!, limit: "40", "sort[]": "date.event:desc", "filter[field]": "status", "filter[value][]": "current" }).toString();
    url.searchParams.append("fields[include][]", "name");
    for (const f of ["status", "url", "date", "country", "type", "glide"]) url.searchParams.append("fields[include][]", f);
    const raw = await fetchJson(url.toString(), { timeoutMs: 20_000 });
    const parsed = z.object({ data: z.array(z.unknown()) }).parse(raw);
    const data = normalizeReliefweb(parsed.data.flatMap((d) => {
      const r = Disaster.safeParse(d);
      return r.success ? [r.data] : [];
    }));
    return { data, sourceUpdatedAt: data[0]?.time ?? null };
  },
});
