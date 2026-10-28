import type { NextRequest } from "next/server";
import { PROVIDER_BY_ID } from "@/server/registry";
import { runProvider } from "@/server/runner";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = PROVIDER_BY_ID.get(id);
  if (!provider) return Response.json({ error: "Unknown provider" }, { status: 404 });

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = provider.params.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid parameters", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }

  const envelope = await runProvider(provider, parsed.data);
  // Let a CDN share results between users; stale data may be served briefly while revalidating.
  const ttl = Math.max(5, Math.floor(provider.refreshSeconds / 2));
  const cacheControl = envelope.data == null ? "no-store" : `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${provider.refreshSeconds}`;
  return Response.json(envelope, { headers: { "Cache-Control": cacheControl } });
}
