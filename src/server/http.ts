import "server-only";

export const USER_AGENT =
  process.env.ATLAS_USER_AGENT ??
  "ATLAS-Global-Intelligence-Center/1.0 (+https://github.com/; personal non-commercial dashboard)";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function doFetch(url: string, opts: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...opts.headers },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (res.status === 429) throw new UpstreamError("Rate limit reached (HTTP 429)", 429);
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
    return res;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new UpstreamError(`Timeout contacting ${new URL(url).host}`);
    }
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    throw new UpstreamError(`Network error contacting ${new URL(url).host}${cause ? ` (${cause})` : ""}`);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchJson(url: string, opts: FetchOptions = {}): Promise<unknown> {
  const res = await doFetch(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError(`Invalid JSON from ${new URL(url).host}`);
  }
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await doFetch(url, opts);
  return res.text();
}
