import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { DAMITV_CHANNELS } from "../../live-tv/damitv-channels";

// ============================================================
// LIVE TV CHANNELS API — CSV channels + logos from dlhd.pk
// Uses DAMITV_CHANNELS which includes:
//   - category (Sports, News, Entertainment, etc.)
//   - country (USA, UK, Canada, etc.)
//   - logoUrl (dlhd.pk/logos/{slug}.png format)
// Also loads local logo-map.json as fallback for known logos
// ============================================================

export const dynamic = "force-dynamic";
export const revalidate = 300;

// ── Load logo map once at module level (cached across requests) ──
let _logoMapCache: { byId: Record<string, string>; byName: Record<string, string> } | null = null;

function getLogoMap(): { byId: Record<string, string>; byName: Record<string, string> } {
  if (_logoMapCache) return _logoMapCache;
  try {
    const mapPath = join(process.cwd(), "data", "channel-logo-map.json");
    const raw = readFileSync(mapPath, "utf-8");
    const data = JSON.parse(raw);
    _logoMapCache = {
      byId: data.by_id || {},
      byName: data.by_name || {},
    };
  } catch {
    _logoMapCache = { byId: {}, byName: {} };
  }
  return _logoMapCache!;
}

// ── Country detection from channel name ──
const COUNTRY_PATTERNS: Record<string, { code: string; name: string; flag: string }> = {
  "USA": { code: "US", name: "United States", flag: "🇺🇸" },
  "American": { code: "US", name: "United States", flag: "🇺🇸" },
  "UK": { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  "France": { code: "FR", name: "France", flag: "🇫🇷" },
  "Turkey": { code: "TR", name: "Turkey", flag: "🇹🇷" },
  "Spain": { code: "ES", name: "Spain", flag: "🇪🇸" },
  "Portugal": { code: "PT", name: "Portugal", flag: "🇵🇹" },
  "Germany": { code: "DE", name: "Germany", flag: "🇩🇪" },
  "Poland": { code: "PL", name: "Poland", flag: "🇵🇱" },
  "Serbia": { code: "RS", name: "Serbia", flag: "🇷🇸" },
  "Croatia": { code: "HR", name: "Croatia", flag: "🇭🇷" },
  "Bulgaria": { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  "Malaysia": { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  "Australia": { code: "AU", name: "Australia", flag: "🇦🇺" },
  "Canada": { code: "CA", name: "Canada", flag: "🇨🇦" },
  "Brazil": { code: "BR", name: "Brazil", flag: "🇧🇷" },
  "Israel": { code: "IL", name: "Israel", flag: "🇮🇱" },
  "Qatar": { code: "QA", name: "Qatar", flag: "🇶🇦" },
  "UAE": { code: "AE", name: "UAE", flag: "🇦🇪" },
  "Italy": { code: "IT", name: "Italy", flag: "🇮🇹" },
  "India": { code: "IN", name: "India", flag: "🇮🇳" },
  "Japan": { code: "JP", name: "Japan", flag: "🇯🇵" },
  "South Korea": { code: "KR", name: "South Korea", flag: "🇰🇷" },
  "China": { code: "CN", name: "China", flag: "🇨🇳" },
  "Middle East": { code: "AE", name: "Middle East", flag: "🌍" },
  "New Zealand": { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  "Ireland": { code: "IE", name: "Ireland", flag: "🇮🇪" },
  "Switzerland": { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  "Netherlands": { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  "Sweden": { code: "SE", name: "Sweden", flag: "🇸🇪" },
  "Norway": { code: "NO", name: "Norway", flag: "🇳🇴" },
  "Denmark": { code: "DK", name: "Denmark", flag: "🇩🇰" },
  "Finland": { code: "FI", name: "Finland", flag: "🇫🇮" },
  "Greece": { code: "GR", name: "Greece", flag: "🇬🇷" },
  "Romania": { code: "RO", name: "Romania", flag: "🇷🇴" },
  "Hungary": { code: "HU", name: "Hungary", flag: "🇭🇺" },
  "Czech": { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  "Austria": { code: "AT", name: "Austria", flag: "🇦🇹" },
  "Belgium": { code: "BE", name: "Belgium", flag: "🇧🇪" },
  "Mexico": { code: "MX", name: "Mexico", flag: "🇲🇽" },
  "Argentina": { code: "AR", name: "Argentina", flag: "🇦🇷" },
  "Chile": { code: "CL", name: "Chile", flag: "🇨🇱" },
  "Colombia": { code: "CO", name: "Colombia", flag: "🇨🇴" },
  "Peru": { code: "PE", name: "Peru", flag: "🇵🇪" },
  "Thailand": { code: "TH", name: "Thailand", flag: "🇹🇭" },
  "Indonesia": { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  "Philippines": { code: "PH", name: "Philippines", flag: "🇵🇭" },
  "Singapore": { code: "SG", name: "Singapore", flag: "🇸🇬" },
  "Pakistan": { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  "Bangladesh": { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  "Sri Lanka": { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  "Nigeria": { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  "South Africa": { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  "Egypt": { code: "EG", name: "Egypt", flag: "🇪🇬" },
  "Lebanon": { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  "Morocco": { code: "MA", name: "Morocco", flag: "🇲🇦" },
  "Russia": { code: "RU", name: "Russia", flag: "🇷🇺" },
  "Ukraine": { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  "Bosnia": { code: "BA", name: "Bosnia", flag: "🇧🇦" },
  "Latin America": { code: "LATAM", name: "Latin America", flag: "🌎" },
  "Caribbean": { code: "CB", name: "Caribbean", flag: "🌴" },
};

function detectCountry(countryStr: string): { code: string; name: string; flag: string } {
  if (!countryStr) return { code: "INT", name: "International", flag: "🌍" };

  // Direct match from country string (from damitv-channels.ts)
  for (const [key, data] of Object.entries(COUNTRY_PATTERNS)) {
    if (countryStr.toLowerCase() === key.toLowerCase()) return data;
    if (countryStr.toLowerCase().includes(key.toLowerCase())) return data;
  }

  // Special patterns
  const lower = countryStr.toLowerCase();
  if (lower.includes("arab") || lower.includes("emirate") || lower.includes("dubai") || lower.includes("abu dhabi")) return COUNTRY_PATTERNS.UAE;
  if (lower.includes("british") || lower.includes("britain")) return COUNTRY_PATTERNS.UK;
  if (lower.includes("australian")) return COUNTRY_PATTERNS.Australia;
  if (lower.includes("canadian")) return COUNTRY_PATTERNS.Canada;
  if (lower.includes("spanish")) return COUNTRY_PATTERNS.Spain;
  if (lower.includes("french")) return COUNTRY_PATTERNS.France;
  if (lower.includes("italian")) return COUNTRY_PATTERNS.Italy;
  if (lower.includes("german")) return COUNTRY_PATTERNS.Germany;
  if (lower.includes("dutch")) return COUNTRY_PATTERNS.Netherlands;
  if (lower.includes("swiss")) return COUNTRY_PATTERNS.Switzerland;
  if (lower.includes("polish")) return COUNTRY_PATTERNS.Poland;
  if (lower.includes("serbian")) return COUNTRY_PATTERNS.Serbia;
  if (lower.includes("croatian")) return COUNTRY_PATTERNS.Croatia;
  if (lower.includes("malaysian")) return COUNTRY_PATTERNS.Malaysia;
  if (lower.includes("indian")) return COUNTRY_PATTERNS.India;
  if (lower.includes("korean")) return COUNTRY_PATTERNS.SouthKorea;
  if (lower.includes("japanese")) return COUNTRY_PATTERNS.Japan;
  if (lower.includes("chinese")) return COUNTRY_PATTERNS.China;

  return { code: "INT", name: countryStr, flag: "🌍" };
}

// ── Find logo — tv-logo URLs (github) take priority ──
function findLogo(
  channelId: number,
  channelName: string,
  channelLogoUrl: string,
  byId: Record<string, string>,
  byName: Record<string, string>
): string {
  // 0) tv-logo GitHub URLs are reliable — use them directly
  if (channelLogoUrl && channelLogoUrl.includes("raw.githubusercontent.com")) {
    return channelLogoUrl;
  }

  // 1) Exact ID match from logo map (only use non-broken URLs)
  const idStr = String(channelId);
  const idLogo = byId[idStr];
  if (idLogo && !idLogo.includes("dlhd.pk") && !idLogo.includes("cdnlivetv")) return idLogo;

  // 2) Exact name match from logo map (only use non-broken URLs)
  const lower = channelName.toLowerCase().trim();
  const nameLogo = byName[lower];
  if (nameLogo && !nameLogo.includes("dlhd.pk") && !nameLogo.includes("cdnlivetv")) return nameLogo;

  // 3) Strip suffixes and retry
  const suffixes = [" usa", " uk", " france", " turkey", " spain", " portugal", " germany", " poland", " serbia", " croatia", " bulgaria", " malaysia", " australia", " canada", " brasil", " israel", " qatar", " mx", " uae", " de", " pt", " cz", " sk", " hd", " premium"];
  for (const suf of suffixes) {
    if (lower.endsWith(suf)) {
      const stripped = lower.slice(0, -suf.length).trim();
      const strippedLogo = byName[stripped];
      if (strippedLogo && !strippedLogo.includes("dlhd.pk") && !strippedLogo.includes("cdnlivetv")) return strippedLogo;
    }
  }

  // 4) Substring match (only non-broken URLs)
  for (const [key, url] of Object.entries(byName)) {
    if ((lower.includes(key) || key.includes(lower)) && !url.includes("dlhd.pk") && !url.includes("cdnlivetv")) return url;
  }

  // 5) Fallback: channel logo URL from damitv-channels.ts (tv-logo URLs)
  if (channelLogoUrl) return channelLogoUrl;

  return "";
}

interface Channel {
  id: string;
  name: string;
  category: string;
  country: { code: string; name: string; flag: string };
  embedUrl: string;
  source: "damitv";
  logoUrl: string;
  isLive: boolean;
  isAlwaysLive: boolean;
  status: string;
  damitvId: number;
  damitvEmbedUrl: string;
  streamUrl: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchQuery = url.searchParams.get("search") || "";
  const categoryFilter = url.searchParams.get("category") || "all";
  const countryFilter = url.searchParams.get("country") || "all";

  try {
    const { byId, byName } = getLogoMap();

    const seenNames = new Set<string>();
    const allChannels: Channel[] = [];

    for (const ch of DAMITV_CHANNELS) {
      if (!ch.name || ch.name.startsWith("18+")) continue;
      if (seenNames.has(ch.name.toLowerCase())) continue;
      seenNames.add(ch.name.toLowerCase());

      const category = ch.category;
      const country = detectCountry(ch.country);
      const logoUrl = findLogo(ch.id, ch.name, ch.logoUrl, byId, byName);

      allChannels.push({
        id: `dami-${ch.id}`,
        name: ch.name,
        category,
        country,
        embedUrl: ch.streamUrl,
        source: "damitv",
        logoUrl,
        isLive: true,
        isAlwaysLive: true,
        status: "live",
        damitvId: ch.id,
        damitvEmbedUrl: `https://dami-tv.pro/embed/?id=${ch.id}`,
        streamUrl: ch.streamUrl,
      });
    }

    // Apply filters
    let filtered = allChannels;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ch => ch.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter(ch => ch.category.toLowerCase() === categoryFilter.toLowerCase());
    }
    if (countryFilter !== "all") {
      filtered = filtered.filter(ch => ch.country.code === countryFilter);
    }

    const categoryCounts: Record<string, number> = {};
    for (const ch of allChannels) categoryCounts[ch.category] = (categoryCounts[ch.category] || 0) + 1;

    const countryCounts: Record<string, { code: string; name: string; flag: string; count: number }> = {};
    for (const ch of allChannels) {
      const key = ch.country.code;
      if (!countryCounts[key]) countryCounts[key] = { ...ch.country, count: 0 };
      countryCounts[key].count++;
    }

    const sortedCountries = Object.values(countryCounts).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: allChannels.length > 0,
      total: filtered.length,
      totalAll: allChannels.length,
      categories: Object.entries(categoryCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      countries: sortedCountries,
      channels: filtered,
    });
  } catch (error: any) {
    console.error("Live TV channels API error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch channels", channels: [], categories: [], countries: [], total: 0, totalAll: 0 },
      { status: 500 }
    );
  }
}
