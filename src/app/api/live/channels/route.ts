import { NextResponse } from "next/server";
import { DAMITV_CHANNELS } from "../../live-tv/damitv-channels";

// ============================================================
// LIVE CHANNELS API — Enhanced with logos, categories, countries
// Channel data comes from damitv-channels.ts which includes:
//   - category (Sports, News, Entertainment, etc.)
//   - country (USA, UK, Canada, etc.)
//   - logoUrl (dlhd.pk logo format)
// ============================================================

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const channels = DAMITV_CHANNELS
      .filter(ch => ch.name && !ch.name.startsWith("18+"))
      .map(ch => ({
        id: `dami-${ch.id}`,
        title: ch.name,
        sport: "other",
        sportName: ch.category,
        isLive: true,
        apiSource: "damitv",
        channelName: ch.name,
        damitvId: String(ch.id),
        damitvName: ch.name,
        poster: ch.logoUrl,
        streamUrl: ch.streamUrl,
        embedUrl: ch.streamUrl,
        sources: [{ source: "damitv", id: String(ch.id) }],
        category: ch.category,
        country: ch.country,
        logoUrl: ch.logoUrl,
      }));

    return NextResponse.json(channels);
  } catch (error: any) {
    console.error("Live channels API error:", error.message);
    return NextResponse.json([]);
  }
}
