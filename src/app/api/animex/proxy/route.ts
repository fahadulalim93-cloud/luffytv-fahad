import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side HLS Proxy for AnimeX streams
 *
 * GET /api/animex/proxy?url={encoded_url}&provider={provider_id}&type={manifest|segment}
 *
 * ALL AnimeX providers go through this proxy because they need specific headers:
 *   - Kiwi:  Origin/Referer: anidb.app (Cloudflare protected)
 *   - Mimi:  Referer: animex.one (sub-playlists need it), segments PNG-wrapped TS
 *   - Yuki:  Referer: megaplay.buzz (Cloudflare bypass), TS disguised as .jpg
 *   - Mochi: Referer: animex.one (MP4 with expiring tokens)
 *   - Kami:  Referer: animex.one
 *
 * This proxy:
 *   1. Adds correct Origin/Referer headers per provider
 *   2. Rewrites m3u8 manifests so segment URLs go through proxy
 *   3. Strips PNG wrapper from mimi segments
 *   4. Detects TS data disguised as .jpg (yuki)
 *   5. Passes through MP4 for mochi
 */

const PROVIDER_HEADERS: Record<string, Record<string, string>> = {
  miku: {
    Referer: "https://allanime.uns.bio",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  },
  yuki: {
    Referer: "https://megaplay.buzz/",
  },
  vee: {
    Referer: "https://www.animeonsen.xyz/",
  },
  kiwi: {
    Origin: "https://anidb.app",
    Referer: "https://anidb.app/",
  },
  mimi: {
    Origin: "https://animex.one",
    Referer: "https://animex.one/",
  },
  mochi: {
    Referer: "https://animex.one",
  },
  kami: {
    Origin: "https://animex.one",
    Referer: "https://animex.one/",
  },
  beep: {},
  uwu: {},
};

// PNG header signature to detect and strip (mimi segments are PNG-wrapped TS)
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_PNG_HEADER = 200;

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        ...headers,
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip PNG wrapper from TS segment data (mimi/24stream segments)
 */
function stripPngWrapper(data: Buffer): Buffer {
  for (let i = 8; i < Math.min(data.length, MAX_PNG_HEADER + 100); i++) {
    if (data[i] === 0x47 && i + 3 < data.length) {
      const pid = ((data[i + 1] & 0x1f) << 8) | data[i + 2];
      if (pid < 0x1fff) {
        return data.subarray(i);
      }
    }
  }
  return data;
}

/**
 * Rewrite m3u8 manifest: replace all URLs with our proxy URLs
 */
function rewriteM3u8(content: string, provider: string, baseUrl: string): string {
  const lines = content.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#") || trimmed === "") {
      // Rewrite URI= attributes in #EXT-X-MAP and #EXT-X-MEDIA tags
      if (trimmed.includes("URI=\"")) {
        const uriMatch = trimmed.match(/URI="([^"]+)"/);
        if (uriMatch) {
          const originalUri = uriMatch[1];
          const resolvedUrl = resolveUrl(originalUri, baseUrl);
          const proxyUrl = buildProxyUrl(resolvedUrl, provider, "manifest");
          rewritten.push(line.replace(uriMatch[1], proxyUrl));
          continue;
        }
      }
      rewritten.push(line);
      continue;
    }

    // URL line (segment or sub-playlist)
    const resolvedUrl = resolveUrl(trimmed, baseUrl);
    // Detect sub-playlists: .m3u8, .txt (miku uses .txt for sub-playlists), or any URL
    // that looks like a playlist (short name without TS/MP4 extension)
    const isPlaylist = resolvedUrl.includes(".m3u8") || resolvedUrl.includes("m3u8") ||
      resolvedUrl.includes(".txt") ||  // miku sub-playlists use .txt extension
      (!resolvedUrl.includes(".ts") && !resolvedUrl.includes(".mp4") &&
       !resolvedUrl.includes(".jpg") && !resolvedUrl.includes(".png") &&
       !resolvedUrl.includes(".m4s"));  // not a known segment format
    const type = isPlaylist ? "manifest" : "segment";
    const proxyUrl = buildProxyUrl(resolvedUrl, provider, type);
    rewritten.push(proxyUrl);
  }

  return rewritten.join("\n");
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function buildProxyUrl(targetUrl: string, provider: string, type: string): string {
  const encoded = encodeURIComponent(targetUrl);
  return `/api/animex/proxy?url=${encoded}&provider=${provider}&type=${type}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const provider = searchParams.get("provider") || "mimi";
    const type = searchParams.get("type") || "manifest";

    if (!targetUrl) {
      return NextResponse.json({ error: "url parameter required" }, { status: 400 });
    }

    const headers = PROVIDER_HEADERS[provider] || {};
    const res = await fetchWithTimeout(targetUrl, headers, 15000);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}: ${res.statusText}`, url: targetUrl },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "";

    // If it's an m3u8 manifest, rewrite URLs to go through our proxy
    // Also handle .txt extensions (miku uses .txt for sub-playlists)
    const mightBeManifest =
      type === "manifest" ||
      targetUrl.includes(".m3u8") ||
      targetUrl.includes(".txt") ||
      contentType.includes("mpegurl") ||
      contentType.includes("vnd.apple.mpegurl");

    if (mightBeManifest) {
      const text = await res.text();

      // Check if it's actually a redirect/HTML error page
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        return NextResponse.json(
          { error: "Got HTML instead of m3u8 — upstream blocked", url: targetUrl },
          { status: 502 }
        );
      }

      // Check if it's actually HLS content (starts with #EXTM3U or has EXT-X tags)
      const isHls = text.trimStart().startsWith("#EXTM3U") || text.includes("#EXT-X-");
      if (isHls) {
        const rewritten = rewriteM3u8(text, provider, targetUrl);

        return new NextResponse(rewritten, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "public, max-age=5",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
          },
        });
      }
      // Not HLS text — fall through to segment handling below
    }

    // For segments (TS data) or MP4 (mochi)
    const arrayBuf = await res.arrayBuffer();
    let data: Buffer = Buffer.from(arrayBuf) as Buffer;
    const upstreamContentType = res.headers.get("content-type") || "";

    // For Mimi provider: strip PNG wrapper from TS segments
    // Segments on ibyteimg.com are served as image/png but contain MPEG-TS data
    if (provider === "mimi" && data.length > 100) {
      if (
        data[0] === PNG_MAGIC[0] &&
        data[1] === PNG_MAGIC[1] &&
        data[2] === PNG_MAGIC[2] &&
        data[3] === PNG_MAGIC[3]
      ) {
        data = stripPngWrapper(data);
      }
    }

    // For Yuki provider: segments are TS disguised as .jpg/.html/.js/.css
    // The content-type will be image/jpeg etc but the data starts with 0x47 (TS sync)
    let responseContentType = upstreamContentType;
    if (provider === "yuki" && data.length > 4 && data[0] === 0x47) {
      responseContentType = "video/mp2t";
    }

    // Detect content type for mochi (MP4)
    const isMP4 = upstreamContentType.includes("mp4") || targetUrl.includes(".mp4") ||
      (data.length > 8 && data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70);

    if (isMP4) responseContentType = "video/mp4";
    else if (responseContentType.includes("mpegurl") || responseContentType.includes("mpeg")) {
      responseContentType = "video/mp2t";
    }
    // Default to TS if still ambiguous
    if (!responseContentType.includes("mp4") && !responseContentType.includes("mp2t") && !responseContentType.includes("mpeg")) {
      if (data.length > 4 && data[0] === 0x47) {
        responseContentType = "video/mp2t";
      } else {
        responseContentType = "video/mp2t";
      }
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": responseContentType,
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        ...(isMP4 ? { "Accept-Ranges": "bytes" } : {}),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Proxy fetch failed";
    console.error("[AnimeX Proxy Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
