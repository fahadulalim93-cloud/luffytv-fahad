import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEOUT_MS = 12000;

// ─── DamiTV / PPV.to Types ───
interface DamiTVSource {
  source: string;
  id: string;
  name: string;
  embed: string;
}

interface DamiTVStream {
  id: string;
  name: string;
  poster: string;
  starts_at: number;
  ends_at: number;
  category_name: string;
  status: string;
  league: string;
  teams: {
    home: { name: string; badge: string };
    away: { name: string; badge: string };
  };
  uri_name: string;
  viewers: number;
  always_live: number;
  tag: string;
  source_tag?: string;
  iframe: string | null;
  embed: string | null;
  sources: DamiTVSource[];
  substreams?: Array<{
    id: number;
    name: string;
    tag: string;
    source_tag: string;
    uri_name: string;
    iframe: string;
  }>;
}

interface DamiTVCategory {
  category: string;
  id: number;
  streams: DamiTVStream[];
}

// ─── WatchFooty Types ───
interface WFStream {
  id: string;
  url: string;
  source: string;
  quality: string;
  language: string;
  isRedirect: boolean;
  nsfw: boolean;
}

interface WFMatch {
  matchId: string;
  title: string;
  poster: string;
  teams: Record<string, any>;
  status: string;
  currentMinute: string;
  scores: Record<string, any>;
  date: string;
  timestamp: number;
  league: string;
  sport: string;
  streams: WFStream[];
}

// ─── VIPStreamed Types ───
interface VIPStream {
  quality: string;
  proxy_url: string;
}

interface VIPMatch {
  id: string;
  title: string;
  category: string;
  league: string;
  available: boolean;
  team1: { name: string; logo: string } | null;
  team2: { name: string; logo: string } | null;
  streams: VIPStream[];
}

// ─── EmbedSports Types ───
interface EmbedSportStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
  viewers: number;
}

// ─── Output Type ───
interface NormalizedMatch {
  id: string;
  title: string;
  category: string;
  league: string;
  viewers: number;
  hd: boolean;
  poster: string;
  status: string;
  servers: Array<{ label: string; embedUrl: string; hd: boolean }>;
}

// ─── Category Mapping ───
function mapDamiCategory(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("american-football") || c.includes("american football")) return "American Football";
  if (c.includes("australian") || c.includes("afl")) return "AFL";
  if (c.includes("baseball")) return "Baseball";
  if (c.includes("basketball")) return "Basketball";
  if (c.includes("combat") || c.includes("fight") || c.includes("mma") || c.includes("ufc") || c.includes("boxing") || c.includes("wwe") || c.includes("aew")) return "MMA/Boxing";
  if (c.includes("cricket")) return "Cricket";
  if (c.includes("football") || c.includes("soccer")) return "Football";
  if (c.includes("hockey") || c.includes("ice hockey")) return "Hockey";
  if (c.includes("motor") || c.includes("f1") || c.includes("racing")) return "Motorsport";
  if (c.includes("rugby")) return "Rugby";
  if (c.includes("tennis")) return "Tennis";
  if (c.includes("golf")) return "Golf";
  if (c.includes("wrestling")) return "MMA/Boxing";
  if (c.includes("24/7")) return "24/7 Streams";
  return "Sports";
}

function mapWFSport(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes("football") || s.includes("soccer")) return "Football";
  if (s.includes("basketball")) return "Basketball";
  if (s.includes("baseball")) return "Baseball";
  if (s.includes("hockey")) return "Hockey";
  if (s.includes("cricket")) return "Cricket";
  if (s.includes("tennis")) return "Tennis";
  if (s.includes("golf")) return "Golf";
  if (s.includes("rugby")) return "Rugby";
  if (s.includes("mma") || s.includes("ufc") || s.includes("boxing") || s.includes("fight") || s.includes("darts")) return "MMA/Boxing";
  if (s.includes("motor") || s.includes("f1") || s.includes("racing")) return "Motorsport";
  if (s.includes("volleyball")) return "Sports";
  return "Sports";
}

function mapVIPCategory(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("soccer") || c.includes("football")) return "Football";
  if (c.includes("basketball")) return "Basketball";
  if (c.includes("baseball")) return "Baseball";
  if (c.includes("hockey")) return "Hockey";
  if (c.includes("cricket")) return "Cricket";
  if (c.includes("tennis")) return "Tennis";
  if (c.includes("racing") || c.includes("motor") || c.includes("f1")) return "Motorsport";
  return "Sports";
}

function parseCategory(id: string, language: string): string {
  const combined = (id + " " + language).toLowerCase();
  if (combined.includes("cricket") || combined.includes("ipl")) return "Cricket";
  if (combined.includes("soccer") || combined.includes("football") || combined.includes("premier") || combined.includes("la liga") || combined.includes("serie a") || combined.includes("bundesliga")) return "Football";
  if (combined.includes("basketball") || combined.includes("nba")) return "Basketball";
  if (combined.includes("baseball") || combined.includes("mlb")) return "Baseball";
  if (combined.includes("hockey") || combined.includes("nhl")) return "Hockey";
  if (combined.includes("tennis")) return "Tennis";
  if (combined.includes("mma") || combined.includes("ufc") || combined.includes("boxing") || combined.includes("fight") || combined.includes("ppv")) return "MMA/Boxing";
  if (combined.includes("rugby")) return "Rugby";
  if (combined.includes("golf")) return "Golf";
  if (combined.includes("f1") || combined.includes("motorsport") || combined.includes("racing")) return "Motorsport";
  return "Sports";
}

function parseLeague(id: string, language: string): string {
  const combined = (id + " " + language).toLowerCase();
  if (combined.includes("ipl") || combined.includes("indian premier league")) return "Indian Premier League";
  if (combined.includes("premier league") || combined.includes("epl")) return "Premier League";
  if (combined.includes("la liga")) return "La Liga";
  if (combined.includes("serie a")) return "Serie A";
  if (combined.includes("bundesliga")) return "Bundesliga";
  if (combined.includes("champions league") || combined.includes("ucl")) return "UEFA Champions League";
  if (combined.includes("nba")) return "NBA";
  if (combined.includes("mlb")) return "MLB";
  if (combined.includes("nhl")) return "NHL";
  if (combined.includes("ufc")) return "UFC";
  if (combined.includes("f1")) return "Formula 1";
  return "";
}

function formatTitle(id: string): string {
  return id
    .replace(/^ppv-/, "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(" Vs ", " vs ");
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timer);
    return res;
  } catch {
    return null;
  }
}

// Dedup helper: find existing match by title similarity
function findExistingMatch(allMatches: NormalizedMatch[], title: string): NormalizedMatch | undefined {
  const titleLower = title.toLowerCase();
  const titleParts = titleLower.split(" vs ")[0].trim();
  return allMatches.find(m => {
    const mLower = m.title.toLowerCase();
    return mLower.includes(titleParts) || titleLower.includes(mLower.split(" vs ")[0].trim());
  });
}

export async function GET() {
  const seen = new Set<string>();
  const allMatches: NormalizedMatch[] = [];

  // ═══════════════════════════════════════════════════════════
  // Source 1: DamiTV API — PRIMARY
  // https://dami-tv.pro/papi/api/streams
  // ═══════════════════════════════════════════════════════════
  try {
    const res = await fetchWithTimeout("https://dami-tv.pro/papi/api/streams", TIMEOUT_MS);
    if (res && res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streams)) {
        const categories: DamiTVCategory[] = data.streams;

        for (const cat of categories) {
          if (cat.category === "24/7-streams") continue;

          for (const stream of cat.streams) {
            const id = `damitv-${stream.id}`;
            if (seen.has(id)) continue;
            seen.add(id);

            const servers: Array<{ label: string; embedUrl: string; hd: boolean }> = [];

            // Main embed URL from DamiTV API
            const mainEmbedUrl = stream.embed || stream.iframe || `https://dami-tv.pro/embed/?id=${encodeURIComponent(stream.id)}`;

            // Add sources from API (multiple servers per match)
            if (Array.isArray(stream.sources) && stream.sources.length > 0) {
              for (const src of stream.sources) {
                if (src.embed) {
                  servers.push({
                    label: src.name || `DamiTV ${servers.length + 1}`,
                    embedUrl: src.embed,
                    hd: true,
                  });
                }
              }
            }

            // Always ensure main embed is first
            if (servers.length === 0 || !servers.some(s => s.embedUrl === mainEmbedUrl)) {
              servers.unshift({ label: "DamiTV Server 1", embedUrl: mainEmbedUrl, hd: true });
            }

            // HLS resolver as backup
            const hlsUrl = `https://dami-tv.pro/player/hls/?v=300&resolve=${stream.id}&name=${encodeURIComponent(stream.name)}`;
            if (!servers.some(s => s.embedUrl === hlsUrl)) {
              servers.push({ label: "DamiTV HLS", embedUrl: hlsUrl, hd: true });
            }

            // Add substreams as additional servers (PPV.to style)
            if (Array.isArray(stream.substreams) && stream.substreams.length > 0) {
              for (const sub of stream.substreams) {
                if (sub.iframe && !servers.some(s => s.embedUrl === sub.iframe)) {
                  servers.push({
                    label: sub.source_tag || sub.tag || `DamiTV Alt ${servers.length + 1}`,
                    embedUrl: sub.iframe,
                    hd: true,
                  });
                }
              }
            }

            const category = mapDamiCategory(stream.category_name || cat.category);
            const leagueName = stream.league || stream.tag || "";

            allMatches.push({
              id,
              title: stream.name,
              category,
              league: leagueName,
              viewers: stream.viewers || 0,
              hd: true,
              poster: stream.poster || "",
              status: stream.status || "upcoming",
              servers,
            });
          }
        }
      }
      console.log(`[Live Matches] DamiTV: ${allMatches.length} matches`);
    }
  } catch (error) {
    console.error("[Live Matches] DamiTV error:", error);
  }

  // ═══════════════════════════════════════════════════════════
  // Source 2: PPV.to API — same format as DamiTV, adds more matches + substreams
  // https://api.ppv.to/api/streams
  // ═══════════════════════════════════════════════════════════
  try {
    const res = await fetchWithTimeout("https://api.ppv.to/api/streams", TIMEOUT_MS);
    if (res && res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.streams)) {
        const categories: DamiTVCategory[] = data.streams;
        let ppvCount = 0;

        for (const cat of categories) {
          if (cat.category === "24/7 Streams") continue;

          for (const stream of cat.streams) {
            const ppvId = `ppv-${stream.id}`;
            if (seen.has(ppvId)) continue;

            // Try to find existing match from DamiTV for dedup
            const existing = findExistingMatch(allMatches, stream.name);

            if (existing) {
              // Add PPV.to servers as additional options to existing match
              const ppvEmbed = stream.iframe || stream.embed || `https://dami-tv.pro/embed/?id=${encodeURIComponent(stream.id)}`;
              if (ppvEmbed && !existing.servers.some(s => s.embedUrl === ppvEmbed)) {
                existing.servers.push({
                  label: `PPV ${stream.source_tag || stream.tag || "Server"}`,
                  embedUrl: ppvEmbed,
                  hd: true,
                });
              }
              // Add substreams
              if (Array.isArray(stream.substreams) && stream.substreams.length > 0) {
                for (const sub of stream.substreams) {
                  if (sub.iframe && !existing.servers.some(s => s.embedUrl === sub.iframe)) {
                    existing.servers.push({
                      label: `PPV ${sub.source_tag || sub.tag || "Alt"}`,
                      embedUrl: sub.iframe,
                      hd: true,
                    });
                  }
                }
              }
              // Update poster if we don't have one
              if (!existing.poster && stream.poster) {
                existing.poster = stream.poster;
              }
              seen.add(ppvId);
            } else {
              // New match not in DamiTV — add it
              seen.add(ppvId);

              const servers: Array<{ label: string; embedUrl: string; hd: boolean }> = [];
              const mainEmbed = stream.iframe || stream.embed || `https://dami-tv.pro/embed/?id=${encodeURIComponent(stream.id)}`;

              if (mainEmbed) {
                servers.push({ label: `PPV ${stream.source_tag || stream.tag || "Server 1"}`, embedUrl: mainEmbed, hd: true });
              }

              // HLS resolver
              const hlsUrl = `https://dami-tv.pro/player/hls/?v=300&resolve=${stream.id}&name=${encodeURIComponent(stream.name)}`;
              servers.push({ label: "PPV HLS", embedUrl: hlsUrl, hd: true });

              // Substreams
              if (Array.isArray(stream.substreams) && stream.substreams.length > 0) {
                for (const sub of stream.substreams) {
                  if (sub.iframe && !servers.some(s => s.embedUrl === sub.iframe)) {
                    servers.push({
                      label: `PPV ${sub.source_tag || sub.tag || "Alt"}`,
                      embedUrl: sub.iframe,
                      hd: true,
                    });
                  }
                }
              }

              const category = mapDamiCategory(stream.category_name || cat.category);
              const leagueName = stream.league || stream.tag || "";

              allMatches.push({
                id: ppvId,
                title: stream.name,
                category,
                league: leagueName,
                viewers: Number(stream.viewers) || 0,
                hd: true,
                poster: stream.poster || "",
                status: stream.always_live ? "live" : (stream.status || "upcoming"),
                servers,
              });
              ppvCount++;
            }
          }
        }
        console.log(`[Live Matches] PPV.to: ${ppvCount} new matches added`);
      }
    }
  } catch (error) {
    console.error("[Live Matches] PPV.to error:", error);
  }

  // ═══════════════════════════════════════════════════════════
  // Source 3: WatchFooty API — adds sportsEmbed servers + extra matches
  // https://api.watchfooty.st/api/v1/matches/live
  // ═══════════════════════════════════════════════════════════
  try {
    const res = await fetchWithTimeout("https://api.watchfooty.st/api/v1/matches/live", TIMEOUT_MS);
    if (res && res.ok) {
      const matches: WFMatch[] = await res.json();
      if (Array.isArray(matches)) {
        let wfCount = 0;

        for (const m of matches) {
          const wfId = `wf-${m.matchId}`;
          if (seen.has(wfId)) continue;

          const title = m.title || "Live Match";
          const existing = findExistingMatch(allMatches, title);

          if (existing) {
            // Add WatchFooty streams as additional servers
            if (Array.isArray(m.streams)) {
              for (const stream of m.streams) {
                if (stream.url && !existing.servers.some(s => s.embedUrl === stream.url)) {
                  existing.servers.push({
                    label: `WatchFooty ${stream.quality || "SD"}`,
                    embedUrl: stream.url,
                    hd: stream.quality?.includes("HD") || stream.quality?.includes("1080") || stream.quality?.includes("720") || false,
                  });
                }
              }
            }
            seen.add(wfId);
          } else {
            // New match not in DamiTV/PPV — add it
            seen.add(wfId);

            const servers: Array<{ label: string; embedUrl: string; hd: boolean }> = [];
            if (Array.isArray(m.streams)) {
              for (const stream of m.streams) {
                if (stream.url) {
                  servers.push({
                    label: `WatchFooty ${stream.quality || "SD"}`,
                    embedUrl: stream.url,
                    hd: stream.quality?.includes("HD") || stream.quality?.includes("1080") || stream.quality?.includes("720") || false,
                  });
                }
              }
            }

            if (servers.length > 0) {
              allMatches.push({
                id: wfId,
                title,
                category: mapWFSport(m.sport || "sports"),
                league: m.league || "",
                viewers: 0,
                hd: servers.some(s => s.hd),
                poster: m.poster ? `https://api.watchfooty.st${m.poster}` : "",
                status: m.status === "in" ? "live" : "upcoming",
                servers,
              });
              wfCount++;
            }
          }
        }
        console.log(`[Live Matches] WatchFooty: ${wfCount} new matches, ${matches.length} processed`);
      }
    }
  } catch (error) {
    console.error("[Live Matches] WatchFooty error:", error);
  }

  // ═══════════════════════════════════════════════════════════
  // Source 4: VIPStreamed API — adds HLS proxy streams
  // https://api.vipstreamed.live/api/streams
  // ═══════════════════════════════════════════════════════════
  try {
    const res = await fetchWithTimeout("https://api.vipstreamed.live/api/streams", TIMEOUT_MS);
    if (res && res.ok) {
      const data = await res.json();
      const streams: VIPMatch[] = data?.streams || data?.data || (Array.isArray(data) ? data : []);

      if (Array.isArray(streams) && streams.length > 0) {
        let vipCount = 0;

        for (const stream of streams) {
          const vipId = `vip-${stream.id}`;
          if (seen.has(vipId)) continue;

          const title = stream.title || "Live Match";
          const existing = findExistingMatch(allMatches, title);

          if (existing) {
            // Add VIPStreamed HLS proxy servers
            if (Array.isArray(stream.streams)) {
              for (const q of stream.streams) {
                if (q.proxy_url && !existing.servers.some(s => s.embedUrl === q.proxy_url)) {
                  existing.servers.push({
                    label: `Streamed ${q.quality || "HD"}`,
                    embedUrl: q.proxy_url,
                    hd: q.quality?.includes("1080") || q.quality?.includes("720") || false,
                  });
                }
              }
            }
            seen.add(vipId);
          } else {
            // New match — add it
            seen.add(vipId);

            const servers: Array<{ label: string; embedUrl: string; hd: boolean }> = [];
            if (Array.isArray(stream.streams)) {
              for (const q of stream.streams) {
                if (q.proxy_url) {
                  servers.push({
                    label: `Streamed ${q.quality || "HD"}`,
                    embedUrl: q.proxy_url,
                    hd: q.quality?.includes("1080") || q.quality?.includes("720") || false,
                  });
                }
              }
            }

            if (servers.length > 0) {
              const poster = stream.team1?.logo || stream.team2?.logo || "";
              allMatches.push({
                id: vipId,
                title,
                category: mapVIPCategory(stream.category || "sports"),
                league: stream.league || "",
                viewers: 0,
                hd: servers.some(s => s.hd),
                poster,
                status: stream.available ? "live" : "upcoming",
                servers,
              });
              vipCount++;
            }
          }
        }
        console.log(`[Live Matches] VIPStreamed: ${vipCount} new matches, ${streams.length} processed`);
      }
    }
  } catch (error) {
    console.error("[Live Matches] VIPStreamed error:", error);
  }

  // ═══════════════════════════════════════════════════════════
  // Source 5: EmbedSports — adds extra servers for existing matches
  // https://embedsports.top/fetch
  // ═══════════════════════════════════════════════════════════
  try {
    const res = await fetchWithTimeout("https://embedsports.top/fetch", TIMEOUT_MS);
    if (res && res.ok) {
      const data = await res.json();
      const streams: EmbedSportStream[] = Array.isArray(data) ? data : [];

      if (streams.length > 0) {
        const grouped = new Map<string, EmbedSportStream[]>();
        for (const s of streams) {
          if (!grouped.has(s.id)) grouped.set(s.id, []);
          grouped.get(s.id)!.push(s);
        }

        for (const [id, servers] of grouped) {
          const esId = `es-${id}`;
          const title = formatTitle(id);
          const existing = findExistingMatch(allMatches, title);

          if (existing) {
            for (const s of servers) {
              existing.servers.push({
                label: `EmbedSports ${s.streamNo}${s.hd ? " HD" : ""}`,
                embedUrl: s.embedUrl,
                hd: s.hd,
              });
            }
          } else if (!seen.has(esId)) {
            seen.add(esId);
            const first = servers[0];
            allMatches.push({
              id: esId,
              title,
              category: parseCategory(id, first.language),
              league: parseLeague(id, first.language),
              viewers: servers.reduce((sum, s) => sum + (s.viewers || 0), 0),
              hd: servers.some(s => s.hd),
              poster: "",
              status: "live",
              servers: servers.map(s => ({
                label: `EmbedSports ${s.streamNo}${s.hd ? " HD" : ""}`,
                embedUrl: s.embedUrl,
                hd: s.hd,
              })),
            });
          }
        }
        console.log(`[Live Matches] EmbedSports: ${streams.length} streams processed`);
      }
    }
  } catch (error) {
    console.error("[Live Matches] EmbedSports error:", error);
  }

  // Sort: live matches first, then by viewers descending
  allMatches.sort((a, b) => {
    if (a.status === "live" && b.status !== "live") return -1;
    if (a.status !== "live" && b.status === "live") return 1;
    return b.viewers - a.viewers;
  });

  console.log(`[Live Matches] Total: ${allMatches.length} matches`);

  return NextResponse.json(allMatches);
}
