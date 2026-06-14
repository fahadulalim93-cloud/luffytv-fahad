import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Cache for 5 minutes

const TIMEOUT_MS = 15000;

interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string;
  letter: string;
  servers: Array<{ label: string; embedUrl: string }>;
}

// Decode HTML entities
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Category mapping based on channel name keywords
function categorizeChannel(name: string): string {
  const n = name.toLowerCase();
  // Sports channels
  if (n.includes("espn") || n.includes("fox sports") || n.includes("fs1") || n.includes("fs2") ||
      n.includes("nba") || n.includes("nfl") || n.includes("mlb") || n.includes("nhl") ||
      n.includes("ncaa") || n.includes("sec ") || n.includes("big ten") ||
      n.includes("bein") || n.includes("dazn") || n.includes("sky sports") ||
      n.includes("bt sport") || n.includes("tnt sports") || n.includes("arena sport") ||
      n.includes("supersport") || n.includes("astro") || n.includes("willow") ||
      n.includes("tennis") || n.includes("golf") || n.includes("f1") ||
      n.includes("motor") || n.includes("prima sport") || n.includes("sport") ||
      n.includes("tsn") || n.includes("sn ") || n.includes("sportsnet") ||
      n.includes("canal+ sport") || n.includes("movistar") || n.includes("eleven") ||
      n.includes("paramount+") || n.includes("peacock") || n.includes("fanduel") ||
      n.includes("msg") || n.includes("marquee") || n.includes("yes ") ||
      n.includes("bally") || n.includes("spectrum") || n.includes("root sports") ||
      n.includes("acl") || n.includes("monumental") || n.includes("space") ||
      n.includes("win sports") || n.includes("directv") || n.includes("gol tv") ||
      n.includes("victory") || n.includes("ontime") || n.includes("bst") ||
      n.includes("alkass") || n.includes("abu dhabi sport") || n.includes("beout") ||
      n.includes("ssc") || n.includes("cric") || n.includes("star sport") ||
      n.includes("sony ten") || n.includes("sony six") || n.includes("dd sport") ||
      n.includes("super sport") || n.includes("cosmote") || n.includes("nova sport") ||
      n.includes("megalos") || n.includes("trl") || n.includes("trt spor") ||
      n.includes("s sport") || n.includes("a spor") || n.includes("fanatik") ||
      n.includes("digi sport") || n.includes("pro tv") || n.includes("tvp sport") ||
      n.includes("polsat sport") || n.includes("viaplay") || n.includes("v sport") ||
      n.includes("setanta") || n.includes("mir") || n.includes("match") ||
      n.includes("optus") || n.includes("stan sport") || n.includes("kayo") ||
      n.includes("spark") || n.includes("sky sport nz") || n.includes("racing") ||
      n.includes("trak") || n.includes("iran") || n.includes("ufc") ||
      n.includes("wwe") || n.includes("aew") || n.includes("boxing") ||
      n.includes("fight") || n.includes("ppv") || n.includes("manorama") ||
      n.includes("zdf") || n.includes("ard") || n.includes("eurosport") ||
      n.includes("olympic") || n.includes("pluto tv sport")) {
    return "Sports";
  }
  // News channels
  if (n.includes("cnn") || n.includes("bbc") || n.includes("fox news") || n.includes("msnbc") ||
      n.includes("cnbc") || n.includes("news") || n.includes("al jazeera") || n.includes("sky news") ||
      n.includes("nbc news") || n.includes("cbs news") || n.includes("abc news") ||
      n.includes("hln") || n.includes("dw") || n.includes("france 24") || n.includes("rt ") ||
      n.includes("ndtv") || n.includes("aaj tak") || n.includes("republic") ||
      n.includes("times now") || n.includes("india today")) {
    return "News";
  }
  // Kids
  if (n.includes("cartoon") || n.includes("disney") || n.includes("nick") || n.includes("pbs kids") ||
      n.includes("baby") || n.includes("kids") || n.includes("boomerang")) {
    return "Kids";
  }
  // Music
  if (n.includes("mtv music") || n.includes("music") || n.includes("vh1") || n.includes("cmt") ||
      n.includes("bpm") || n.includes("trace")) {
    return "Music";
  }
  // Entertainment
  return "Entertainment";
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/json,*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

// Normalize name for fuzzy logo matching
function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET() {
  const allChannels: Channel[] = [];
  const seen = new Set<string>();

  // ─── Fetch both sources in parallel ───
  const [dlhdRes, damitvRes] = await Promise.all([
    fetchWithTimeout("https://dlhd.pk/24-7-channels.php", TIMEOUT_MS),
    fetchWithTimeout("https://dami-tv.pro/channels.json", TIMEOUT_MS),
  ]);

  // ─── Build logo lookup from DamiTV channels.json ───
  const logoMap = new Map<string, string>();
  if (damitvRes && damitvRes.ok) {
    try {
      const damitvData = await damitvRes.json();
      const channels = damitvData?.channels || [];
      for (const ch of channels) {
        if (ch.name && ch.logo) {
          const key = normalizeForMatch(ch.name);
          logoMap.set(key, ch.logo);
        }
      }
      console.log(`[Live Channels] Logo map: ${logoMap.size} entries from DamiTV channels.json`);
    } catch (e) {
      console.error("[Live Channels] DamiTV channels.json parse error:", e);
    }
  }

  // ─── Parse DLHD 24/7 Channels HTML → DamiTV HLS resolver format ───
  // Channel data from DLHD:
  //   id (from href="/watch.php?id=51") → used as resolve param
  //   name (from data-title="abc usa") → channel display name
  //   letter (from data-first="A") → quick-jump letter
  //
  // Embed URL format: https://dami-tv.pro/player/hls/?v=300&resolve={dlhd_id}&name={encoded_name}
  if (dlhdRes && dlhdRes.ok) {
    try {
      const html = await dlhdRes.text();

      // Pattern: <a class="card" href="/watch.php?id=51" data-title="abc usa" data-first="A">
      const cardPattern = /href="\/watch\.php\?id=(\d+)"[^>]*data-title="([^"]+)"[^>]*data-first="([^"]*)"/gi;
      let match;
      let count = 0;

      while ((match = cardPattern.exec(html)) !== null) {
        const dlhdId = match[1];          // Resolver ID from DLHD
        const rawName = decodeHtmlEntities(match[2]);  // Channel name
        const letter = match[3] || rawName.charAt(0).toUpperCase();

        // Skip duplicates
        if (seen.has(dlhdId)) continue;
        seen.add(dlhdId);

        // Title case the name
        const name = rawName.replace(/\b\w/g, l => l.toUpperCase());

        // Filter out 18+ channels
        if (name.toLowerCase().includes("18+")) continue;

        // Find logo from DamiTV channels.json (exact + fuzzy match)
        const nameKey = normalizeForMatch(rawName);
        let logo = logoMap.get(nameKey) || "";

        // Fuzzy: try substring matching if no exact match
        if (!logo) {
          for (const [key, url] of logoMap) {
            if (key.length > 3 && (nameKey.includes(key) || key.includes(nameKey))) {
              logo = url;
              break;
            }
          }
        }

        // ═══════════════════════════════════════════════════════
        // DamiTV HLS RESOLVER FORMAT — the ONLY format we use
        // https://dami-tv.pro/player/hls/?v=300&resolve={id}&name={encoded_name}
        // ═══════════════════════════════════════════════════════
        const encodedName = encodeURIComponent(name);
        const damitvHlsUrl = `https://dami-tv.pro/player/hls/?v=300&resolve=${dlhdId}&name=${encodedName}`;

        // Backup server: DLHD/DaddyLive embed
        const dlhdBackupUrl = `https://daddylive.org/embed/embed.php?id=${dlhdId}`;

        const category = categorizeChannel(name);

        allChannels.push({
          id: `dlhd-${dlhdId}`,
          name,
          category,
          logo,
          letter,
          servers: [
            { label: "DamiTV HLS", embedUrl: damitvHlsUrl },
            { label: "DLHD Backup", embedUrl: dlhdBackupUrl },
          ],
        });
        count++;
      }

      console.log(`[Live Channels] Parsed ${count} channels from DLHD`);
    } catch (error) {
      console.error("[Live Channels] DLHD parse error:", error);
    }
  } else {
    console.error("[Live Channels] Failed to fetch DLHD:", dlhdRes?.status);
  }

  // Sort by name
  allChannels.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[Live Channels] Returning ${allChannels.length} channels`);

  return NextResponse.json(allChannels);
}
