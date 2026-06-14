import { NextRequest } from "next/server";

// ============================================================
// HLS RESOLVE — fetches master + sub-playlist in ONE request
//
// Instead of hls.js making 2 sequential requests:
//   1. GET /api/hls-proxy?url=MASTER → master m3u8
//   2. GET /api/hls-proxy?url=SUB-PLAYLIST → sub-playlist
//
// This endpoint does BOTH on the server side and returns
// the final sub-playlist with rewritten URLs directly.
// This cuts load time by ~50% (one round-trip instead of two).
// ============================================================

export const runtime = "edge";
export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "*/*",
  Referer: "https://dami-tv.pro/",
  Origin: "https://dami-tv.pro",
};

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url param" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...NO_CACHE_HEADERS },
    });
  }

  try {
    // Step 1: Fetch the master m3u8
    const masterResp = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
    });
    const masterText = await masterResp.text();

    if (!masterText.trimStart().startsWith("#EXTM3U")) {
      return new Response(masterText, {
        status: masterResp.status,
        headers: {
          "Content-Type":
            masterResp.headers.get("content-type") || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          ...NO_CACHE_HEADERS,
        },
      });
    }

    // Step 2: Find the sub-playlist URL in the master
    const subPlaylistUrl = findSubPlaylistUrl(masterText, url);

    if (!subPlaylistUrl) {
      // No sub-playlist — this IS the media playlist already
      const rewritten = rewriteM3U8(masterText, url);
      return new Response(rewritten, {
        status: masterResp.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          ...NO_CACHE_HEADERS,
        },
      });
    }

    // Step 3: Fetch the sub-playlist server-side
    let subText: string;
    try {
      const subResp = await fetch(subPlaylistUrl, {
        headers: FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      subText = await subResp.text();
    } catch {
      // Sub-playlist failed — return master so hls.js can retry
      const rewritten = rewriteM3U8(masterText, url);
      return new Response(rewritten, {
        status: masterResp.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          ...NO_CACHE_HEADERS,
        },
      });
    }

    if (!subText.trimStart().startsWith("#EXTM3U")) {
      const rewritten = rewriteM3U8(masterText, url);
      return new Response(rewritten, {
        status: masterResp.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          ...NO_CACHE_HEADERS,
        },
      });
    }

    // Step 4: Return the sub-playlist with rewritten segment URLs
    const rewritten = rewriteM3U8(subText, subPlaylistUrl);
    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        ...NO_CACHE_HEADERS,
      },
    });
  } catch (err: any) {
    console.error("HLS resolve error:", err.message, "URL:", url);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...NO_CACHE_HEADERS },
    });
  }
}

function findSubPlaylistUrl(content: string, baseUrl: string): string | null {
  const lines = content.split("\n");
  let parsedBase: URL;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    return null;
  }
  const baseDir = parsedBase.href.substring(
    0,
    parsedBase.href.lastIndexOf("/") + 1
  );
  const baseOrigin = parsedBase.origin;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) continue;
        if (nextTrimmed.startsWith("#")) continue;
        if (nextTrimmed.startsWith("http://") || nextTrimmed.startsWith("https://")) {
          return nextTrimmed;
        } else if (nextTrimmed.startsWith("/")) {
          return baseOrigin + nextTrimmed;
        } else {
          return baseDir + nextTrimmed;
        }
      }
    }
  }
  return null;
}

function rewriteM3U8(content: string, baseUrl: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  let parsedBase: URL;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    return content;
  }

  const baseDir = parsedBase.href.substring(
    0,
    parsedBase.href.lastIndexOf("/") + 1
  );
  const baseOrigin = parsedBase.origin;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      result.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      const rewritten = rewriteUriAttributes(trimmed, baseDir, baseOrigin);
      result.push(rewritten);
      continue;
    }

    let absoluteUrl: string;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      absoluteUrl = trimmed;
    } else if (trimmed.startsWith("/")) {
      absoluteUrl = baseOrigin + trimmed;
    } else {
      absoluteUrl = baseDir + trimmed;
    }

    try {
      const parsedUrl = new URL(absoluteUrl);
      const needsProxy =
        parsedUrl.hostname === "dami-tv.pro" ||
        parsedUrl.hostname.endsWith(".dami-tv.pro");

      if (needsProxy) {
        result.push(`/api/hls-proxy?url=${encodeURIComponent(absoluteUrl)}`);
      } else {
        result.push(absoluteUrl);
      }
    } catch {
      result.push(line);
    }
  }

  return result.join("\n");
}

function rewriteUriAttributes(
  line: string,
  baseDir: string,
  baseOrigin: string
): string {
  return line.replace(/URI="([^"]+)"/g, (match, uri: string) => {
    let absoluteUrl: string;
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      absoluteUrl = uri;
    } else if (uri.startsWith("/")) {
      absoluteUrl = baseOrigin + uri;
    } else {
      absoluteUrl = baseDir + uri;
    }

    try {
      const parsedUrl = new URL(absoluteUrl);
      const needsProxy =
        parsedUrl.hostname === "dami-tv.pro" ||
        parsedUrl.hostname.endsWith(".dami-tv.pro");

      if (needsProxy) {
        return `URI="/api/hls-proxy?url=${encodeURIComponent(absoluteUrl)}"`;
      }
      return `URI="${absoluteUrl}"`;
    } catch {
      return match;
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      ...NO_CACHE_HEADERS,
    },
  });
}
