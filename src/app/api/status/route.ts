import { providerHealth } from "@/server/runner";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ time: new Date().toISOString(), providers: providerHealth() }, { headers: { "Cache-Control": "no-store" } });
}
