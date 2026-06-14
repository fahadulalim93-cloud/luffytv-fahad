import { NextRequest, NextResponse } from "next/server";
import { getAnimeBasicInfo, getAnimeDetails, getStreamingEpisodes } from "@/lib/anilist-api";
import { miruroInfo, miruroEpisodes } from "@/lib/miruro-api";
import { getEpisodes, searchAnime } from "@/lib/anime-api";
import { tmdbFindAnimeTMDBId, tmdbFetchAllEpisodeStills } from "@/lib/tmdb-api";
import { tvmazeGetEpisodeStills } from "@/lib/tvmaze-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extract the actual ID and detect its source
function parseAnimeId(rawId: string): { anilistId: number | null; allanimeId: string | null } {
  const cleanId = rawId.replace(/^miruro_/, "").replace(/^mal_/, "");
  if (/^\d+$/.test(cleanId)) {
    return { anilistId: parseInt(cleanId), allanimeId: null };
  }
  return { anilistId: null, allanimeId: cleanId };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const { anilistId, allanimeId: initialAllAnimeId } = parseAnimeId(id);

    let allAnimeId: string | null = initialAllAnimeId;
    let miruroEpsResult: { sub: any[]; dub: any[] } = { sub: [], dub: [] };
    let allAnimeEpisodes: any[] = [];
    let animeTitle: string | null = null;
    let anilistEps: any[] = [];
    let totalEpsFromAniList: number | null = null;
    let tmdbEpisodeStills: Map<number, { still: string; title: string; overview: string }> = new Map();
    let tvmazeStills: Map<number, { image: string; title: string; summary: string }> = new Map();

    if (anilistId) {
      // ── PARALLEL: Fetch AniList details + Miruro episodes + Miruro info simultaneously ──
      const [anilistDataResult, miruroEpsResult_, miruroInfoResult] = await Promise.allSettled([
        getAnimeDetails(anilistId),
        miruroEpisodes(anilistId),
        miruroInfo(anilistId),
      ]);

      // Process AniList data
      if (anilistDataResult.status === 'fulfilled' && anilistDataResult.value) {
        const anilistData = anilistDataResult.value;
        animeTitle = anilistData.title?.english || anilistData.title?.romaji || null;
        totalEpsFromAniList = anilistData.episodes || null;

        if (!totalEpsFromAniList && anilistData.nextAiringEpisode) {
          totalEpsFromAniList = anilistData.nextAiringEpisode.episode;
        }

        if (anilistData.streamingEpisodes && anilistData.streamingEpisodes.length > 0) {
          anilistEps = anilistData.streamingEpisodes.map((ep: any, i: number) => ({
            episodeIdNum: i + 1,
            title: ep.title || null,
            thumbnail: ep.thumbnail || null,
            url: ep.url || null,
            site: ep.site || null,
            source: "anilist",
          }));
        }
      } else {
        // AniList full details failed, try basic info
        try {
          const anilistData = await getAnimeBasicInfo(anilistId);
          if (anilistData) {
            animeTitle = anilistData.title?.english || anilistData.title?.romaji || null;
            totalEpsFromAniList = anilistData.episodes || null;
            if (!totalEpsFromAniList && anilistData.nextAiringEpisode) {
              totalEpsFromAniList = anilistData.nextAiringEpisode.episode;
            }
            if (anilistData.streamingEpisodes?.length > 0) {
              anilistEps = anilistData.streamingEpisodes.map((ep: any, i: number) => ({
                episodeIdNum: i + 1,
                title: ep.title || null,
                thumbnail: ep.thumbnail || null,
                url: ep.url || null,
                site: ep.site || null,
                source: "anilist",
              }));
            }
          }
        } catch { /* basic info fallback failed */ }
      }

      // Process Miruro episodes
      if (miruroEpsResult_.status === 'fulfilled' && miruroEpsResult_.value) {
        miruroEpsResult = miruroEpsResult_.value;
      }

      // Process Miruro info (for title/ep count)
      if (miruroInfoResult.status === 'fulfilled' && miruroInfoResult.value) {
        const miruroInfoData = miruroInfoResult.value;
        if (!animeTitle) animeTitle = miruroInfoData?.title?.english || miruroInfoData?.title?.romaji || null;
        if (!totalEpsFromAniList && miruroInfoData?.episodes) {
          totalEpsFromAniList = miruroInfoData.episodes;
        }
      }
    }

    // ── PARALLEL: Fetch TMDB + TVMaze + AllAnime search simultaneously ──
    if (animeTitle) {
      const [tvmazeResult, tmdbResult, allAnimeSearchResult] = await Promise.allSettled([
        tvmazeGetEpisodeStills(animeTitle),
        (async () => {
          const match = await tmdbFindAnimeTMDBId({ english: animeTitle });
          if (match) return await tmdbFetchAllEpisodeStills(match.tmdbId);
          return new Map<number, { still: string; title: string; overview: string }>();
        })(),
        searchAnime(animeTitle, 1, 5),
      ]);

      if (tvmazeResult.status === 'fulfilled' && tvmazeResult.value.episodes.size > 0) {
        tvmazeStills = tvmazeResult.value.episodes;
      }
      if (tmdbResult.status === 'fulfilled' && tmdbResult.value.size > 0) {
        tmdbEpisodeStills = tmdbResult.value;
      }
      if (allAnimeSearchResult.status === 'fulfilled' && allAnimeSearchResult.value.results?.length > 0) {
        const best = allAnimeSearchResult.value.results.find(
          (r: any) => r.englishName?.toLowerCase() === animeTitle!.toLowerCase() ||
                      r.name?.toLowerCase() === animeTitle!.toLowerCase()
        ) || allAnimeSearchResult.value.results[0];
        allAnimeId = best._id;
      }
    }

    // Step 4: Get AllAnime episodes (only if we found an ID from parallel search)
    if (allAnimeId) {
      try {
        allAnimeEpisodes = await getEpisodes(allAnimeId);
      } catch { /* AllAnime episodes failed */ }
    }

    // Combine all sources: prefer TMDB > Miruro > AniList streaming > AllAnime > TVMaze > banner fallback
    const hasMiruroEps = miruroEpsResult.sub?.length > 0 || miruroEpsResult.dub?.length > 0;
    const hasAnilistEps = anilistEps.length > 0;
    const hasAllAnimeEps = allAnimeEpisodes.length > 0;

    const primarySource = hasMiruroEps ? "miruro" : "none";
    const primaryEps = hasMiruroEps ? miruroEpsResult : { sub: [], dub: [] };

    let finalEpisodes: any[];

    if (hasMiruroEps) {
      const maxEps = Math.max(
        primaryEps.sub?.length || 0,
        primaryEps.dub?.length || 0,
        totalEpsFromAniList || 0
      );
      finalEpisodes = [];
      for (let i = 1; i <= maxEps; i++) {
        const subEp = primaryEps.sub?.find((e: any) => Number(e.number) === i);
        const dubEp = primaryEps.dub?.find((e: any) => Number(e.number) === i);
        const anilistEp = anilistEps.find(e => e.episodeIdNum === i);
        const allAnimeEp = allAnimeEpisodes.find((ae: any) => ae.episodeIdNum === i);

        const tmdbEp = tmdbEpisodeStills.get(i);
        const tvmazeEp = tvmazeStills.get(i);
        finalEpisodes.push({
          episodeIdNum: i,
          title: subEp?.title || dubEp?.title || anilistEp?.title || tmdbEp?.title || tvmazeEp?.title || null,
          thumbnail: tmdbEp?.still || subEp?.thumbnail || dubEp?.thumbnail || anilistEp?.thumbnail || allAnimeEp?.thumbnails?.[0] || tvmazeEp?.image || null,
          description: tmdbEp?.overview || tvmazeEp?.summary || null,
          source: primarySource,
          subSlug: subEp?.slug || subEp?.id || String(i),
          dubSlug: dubEp?.slug || dubEp?.id || null,
        });
      }
    } else if (hasAnilistEps && anilistEps.length > 0) {
      finalEpisodes = [];
      const maxEps = Math.max(anilistEps.length, totalEpsFromAniList || anilistEps.length, allAnimeEpisodes.length);
      for (let i = 1; i <= maxEps; i++) {
        const anilistEp = anilistEps.find(e => e.episodeIdNum === i);
        const allAnimeEp = allAnimeEpisodes.find((ae: any) => ae.episodeIdNum === i);
        const tmdbEp = tmdbEpisodeStills.get(i);
        const tvmazeEp = tvmazeStills.get(i);
        finalEpisodes.push({
          episodeIdNum: i,
          title: anilistEp?.title || tmdbEp?.title || tvmazeEp?.title || null,
          thumbnail: tmdbEp?.still || anilistEp?.thumbnail || allAnimeEp?.thumbnails?.[0] || tvmazeEp?.image || null,
          description: tmdbEp?.overview || tvmazeEp?.summary || null,
          source: anilistEp ? "anilist" : (allAnimeEp ? "allanime" : "numbered"),
        });
      }
    } else if (hasAllAnimeEps) {
      finalEpisodes = allAnimeEpisodes.map(ep => ({
        ...ep,
      }));
    } else if (totalEpsFromAniList && totalEpsFromAniList > 0) {
      finalEpisodes = Array.from({ length: totalEpsFromAniList }, (_, i) => {
        const tmdbEp = tmdbEpisodeStills.get(i + 1);
        const tvmazeEp = tvmazeStills.get(i + 1);
        return {
          episodeIdNum: i + 1,
          title: tmdbEp?.title || tvmazeEp?.title || null,
          thumbnail: tmdbEp?.still || tvmazeEp?.image || null,
          description: tmdbEp?.overview || tvmazeEp?.summary || null,
          source: "numbered",
        };
      });
    } else {
      if (anilistId) {
        finalEpisodes = Array.from({ length: 12 }, (_, i) => {
          const tmdbEp = tmdbEpisodeStills.get(i + 1);
          const tvmazeEp = tvmazeStills.get(i + 1);
          return {
            episodeIdNum: i + 1,
            title: tmdbEp?.title || tvmazeEp?.title || null,
            thumbnail: tmdbEp?.still || tvmazeEp?.image || null,
            description: tmdbEp?.overview || tvmazeEp?.summary || null,
            source: "numbered",
          };
        });
        totalEpsFromAniList = 12;
      } else {
        finalEpisodes = [];
      }
    }

    // Final safety net
    if (finalEpisodes.length === 0 && (anilistId || allAnimeId)) {
      finalEpisodes = Array.from({ length: 12 }, (_, i) => {
        const tmdbEp = tmdbEpisodeStills.get(i + 1);
        const tvmazeEp = tvmazeStills.get(i + 1);
        return {
          episodeIdNum: i + 1,
          title: tmdbEp?.title || tvmazeEp?.title || null,
          thumbnail: tmdbEp?.still || tvmazeEp?.image || null,
          description: tmdbEp?.overview || tvmazeEp?.summary || null,
          source: "numbered",
        };
      });
      if (!totalEpsFromAniList) totalEpsFromAniList = 12;
    }

    return NextResponse.json({
      episodes: finalEpisodes,
      miruroEpisodes: miruroEpsResult,
      allAnimeId,
      totalEpisodes: totalEpsFromAniList || finalEpisodes.length,
      tmdbStillsCount: tmdbEpisodeStills.size,
      _meta: {
        hasMiruro: hasMiruroEps,
        hasAnilist: hasAnilistEps,
        hasAllAnime: hasAllAnimeEps,
        primarySource,
        title: animeTitle,
        totalFromAniList: totalEpsFromAniList,
      }
    });
  } catch (err: any) {
    console.error("[episodes] Unhandled error:", err?.message || err);
    return NextResponse.json({
      episodes: [],
      miruroEpisodes: { sub: [], dub: [] },
      allAnimeId: null,
      totalEpisodes: null,
      _meta: { error: err?.message || "Unknown error" }
    });
  }
}
