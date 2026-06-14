"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "./store";

const HLSPlayer = dynamic(() => import("./hls-player"), { ssr: false });

// ============================================================
// LIVE TV WATCH PAGE — ORIGINAL m3u8 URL from CSV
// hls.js loads the original URL, xhrSetup proxies everything.
// The m3u8 is NEVER modified. hls.js resolves URLs correctly
// against the original dami-tv.pro domain.
// ============================================================

interface LiveTVWatchProps {
  channelId: string;
  channelName: string;
  channelCategory: string;
  channelStreamCategory?: string;
  channelCountryCode?: string;
  channelCountryName?: string;
  channelEmbedUrl: string;
  channelDamitvDefaultUrl?: string;
  channelDamitvId?: number;
  channelDamitvResolveUrl?: string;
  channelViewers?: number;
  channelLogoUrl?: string;
  channelStreamUrl?: string;
}

const CAT_COLORS: Record<string, string> = {
  Sports: "#f97316",
  News: "#3b82f6",
  Entertainment: "#a855f7",
  Kids: "#22c55e",
  Music: "#ec4899",
  Documentary: "#06b6d4",
  Movies: "#eab308",
  General: "#6b7280",
};

export default function LiveTVWatchPage(props: LiveTVWatchProps) {
  const navigate = useAppStore(s => s.navigate);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const categoryColor = CAT_COLORS[props.channelCategory] || CAT_COLORS.General;

  // The ORIGINAL m3u8 URL from CSV — hls.js + xhrSetup handles proxying
  const streamUrl = props.channelStreamUrl || "";

  // Reset when channel changes
  const currentChannelId = props.channelId || "";
  const [prevChannelId, setPrevChannelId] = useState(currentChannelId);
  if (prevChannelId !== currentChannelId) {
    setPlayerReady(false);
    setLoadingElapsed(0);
    setPlayerKey(prev => prev + 1);
    setPrevChannelId(currentChannelId);
  }

  // Loading progress timer
  useEffect(() => {
    if (playerReady) {
      setLoadingElapsed(0);
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      return;
    }

    setLoadingElapsed(0);
    loadingTimerRef.current = setInterval(() => {
      setLoadingElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [playerReady]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      await playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Refresh
  const refreshPlayer = () => {
    setPlayerReady(false);
    setLoadingElapsed(0);
    setPlayerKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col -mx-4 lg:-mx-8 -mt-[75px] pt-0">
      {/* Player Area */}
      <div
        ref={playerContainerRef}
        className="relative w-full bg-black"
        style={{
          height: isFullscreen ? "100vh" : "87vh",
          minHeight: "500px",
          maxHeight: isFullscreen ? "100vh" : "calc(100vh - 20px)",
        }}
      >
        {/* hls.js loads original m3u8, xhrSetup proxies all requests */}
        {streamUrl && (
          <HLSPlayer
            key={`hls-${playerKey}`}
            src={streamUrl}
            autoPlay={true}
            muted={true}
            onError={() => {}}
            onPlaying={() => setPlayerReady(true)}
            className="absolute inset-0"
          />
        )}

        {/* No stream URL */}
        {!streamUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20">
            <p className="text-sm text-white/50">No stream URL available</p>
          </div>
        )}

        {/* Loading overlay */}
        {!playerReady && streamUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-20 pointer-events-none">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-3 border-white/10 border-t-orange-500 animate-spin" />
              <svg className="absolute inset-0 w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeDasharray={`${Math.min(loadingElapsed / 15, 1) * 176} 176`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white/60">Loading stream...</p>
              <p className="text-[11px] text-white/30 mt-1">{props.channelName}</p>
              {loadingElapsed > 0 && (
                <p className="text-[10px] text-white/20 mt-1">{loadingElapsed}s</p>
              )}
              <p className="text-[10px] text-amber-400/70 mt-3 animate-pulse">Please wait at least 30s — be patient</p>
            </div>
          </div>
        )}

        {/* Player Controls */}
        <>
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-2 right-2 z-30 p-2 rounded-lg bg-black/60 text-white/60 hover:text-white hover:bg-black/80 transition-all"
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4m-7 7l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          <button
            onClick={() => { navigate({ page: "live" }); useAppStore.getState().setSectionSubPage("tv-channels"); }}
            className="absolute top-2 left-2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[11px] font-bold">Back</span>
          </button>

          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-white/70 text-center" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
              {props.channelName}
            </p>
          </div>

          {playerReady && (
            <div className="absolute top-2 right-12 z-30 px-2 py-1 rounded bg-black/60">
              <p className="text-[9px] font-bold text-green-400">LIVE</p>
            </div>
          )}
        </>
      </div>

      {/* Channel Info */}
      <div className="px-4 lg:px-8 py-4 max-w-[1400px] mx-auto w-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1
                className="text-xl font-black text-white"
                style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
              >
                {props.channelName || "Live TV Channel"}
              </h1>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded"
                style={{ background: `${categoryColor}20`, color: categoryColor }}
              >
                {props.channelCategory}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-600/15 text-red-400 text-[10px] font-bold">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                LIVE NOW
              </span>
              {props.channelCountryName && (
                <span className="text-[11px] text-white/25">{props.channelCountryName}</span>
              )}
              {playerReady && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                  Playing
                </span>
              )}
            </div>
          </div>

          <button
            onClick={refreshPlayer}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
