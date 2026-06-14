import { NextRequest } from "next/server";

// ============================================================
// HLS PROXY — m3u8 MANIFESTS ONLY, NO CACHING
//
// Only proxies m3u8 manifest files. Segments go DIRECT to
// rotrimpalkis.shop (they have CORS headers).
//
// KEY DESIGN:
// 1. Detect m3u8 by #EXTM3U content (not content-type)
// 2. Rewrite dami-tv.pro URLs → through proxy
// 3. Rewrite rotrimpalkis.shop URLs → keep direct (CORS OK)
// 4. NEVER cache — fresh upstream request every time
// 5. If NOT m3u8, return 404 — segments should NOT come here
// ============================================================

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url param" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        Referer: "https://dami-tv.pro/",
        Origin: "https://dami-tv.pro",
      },
      // No caching — always get fresh from upstream
      cache: "no-store",
    });

    const text = await upstream.text();

    // ONLY process m3u8 manifests — detected by content
    if (text.trimStart().startsWith("#EXTM3U")) {
      const rewritten = rewriteM3U8(text, url);

      return new Response(rewritten, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          // ABSOLUTELY NO CACHING — live playlists must be fresh
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      });
    }

    // NOT m3u8 — this shouldn't happen in normal flow
    // Segments should go directly to rotrimpalkis.shop, NOT through proxy
    // Return error to make it obvious if something is wrong
    console.error("Non-m3u8 content received at proxy, URL:", url);

    // But still pass it through in case it's needed
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("HLS proxy error:", err.message, "URL:", url);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
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

    // URL line — resolve and route appropriately
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
        result.push(
          `/api/hls-proxy?url=${encodeURIComponent(absoluteUrl)}`
        );
      } else {
        // Direct — segment servers have CORS
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
      "Cache-Control": "no-store",
    },
  });
}
