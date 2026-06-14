"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "./store";

// ============================================================
// LIVE TV CHANNEL BROWSER — DamiTV ONLY (CSV-sourced)
// INSTANT RENDER: Shows cards immediately with letter avatars
// Logos load progressively in the background (no blocking)
// Client-side sessionStorage cache for instant revisits
// ============================================================

interface TVChannel {
  id: string;
  name: string;
  category: string;
  country: { code: string; name: string; flag: string };
  embedUrl: string;
  source: "damitv";
  logoUrl?: string;
  isLive?: boolean;
  isAlwaysLive?: boolean;
  status?: string;
  damitvId?: number;
  damitvResolveUrl?: string;
  damitvEmbedUrl?: string;
  damitvHlsUrl?: string;
  streamUrl?: string;
}

interface CategoryInfo {
  name: string;
  count: number;
}

interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  count: number;
}

interface CachedData {
  channels: TVChannel[];
  categories: CategoryInfo[];
  countries: CountryInfo[];
  totalAll: number;
  timestamp: number;
}

// Cache key for sessionStorage
const CACHE_KEY = "luffytv_channels_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Category colors and gradients
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

const CAT_ICONS: Record<string, string> = {
  Sports: "⚽",
  News: "📰",
  Entertainment: "🎬",
  Kids: "🧸",
  Music: "🎵",
  Documentary: "🔬",
  Movies: "🎥",
  General: "📺",
};

// ── sessionStorage helpers ──
function loadCache(): CachedData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachedData = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveCache(data: Omit<CachedData, "timestamp">) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export default function LiveTVPage() {
  const navigate = useAppStore(s => s.navigate);

  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [loadedImgs, setLoadedImgs] = useState<Set<string>>(new Set());

  // Track if initial load from cache happened
  const initialCacheLoaded = useRef(false);

  // ── Load from cache immediately on mount ──
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setChannels(cached.channels);
      setCategories(cached.categories);
      setCountries(cached.countries);
      setTotalAll(cached.totalAll);
      setLoading(false);
      initialCacheLoaded.current = true;
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch channels — uses background refresh when cache exists
  const fetchChannels = useCallback(async (forceRefresh = false) => {
    const hasCache = initialCacheLoaded.current;

    // If we have cache, do a background refresh (don't show spinner)
    if (hasCache && !forceRefresh) {
      setIsBackgroundRefresh(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedCountry !== "all") params.set("country", selectedCountry);

      const res = await fetch(`/api/live-tv/channels?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load channels");
      const data = await res.json();

      const newChannels = data.channels || [];
      const newCategories = data.categories || [];
      const newCountries = data.countries || [];
      const newTotalAll = data.totalAll || 0;

      setChannels(newChannels);
      setCategories(newCategories);
      setCountries(newCountries);
      setTotalAll(newTotalAll);

      // Save to cache (only for unfiltered "all" queries)
      if (!searchQuery && selectedCategory === "all" && selectedCountry === "all") {
        saveCache({
          channels: newChannels,
          categories: newCategories,
          countries: newCountries,
          totalAll: newTotalAll,
        });
      }

      initialCacheLoaded.current = true;
    } catch (err: any) {
      // Only show error if we have NO data at all
      if (channels.length === 0) {
        setError(err.message || "Failed to load channels");
      }
    } finally {
      setLoading(false);
      setIsBackgroundRefresh(false);
    }
  }, [searchQuery, selectedCategory, selectedCountry, channels.length]);

  // Initial fetch + filter changes
  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Watch channel
  const handleWatch = (channel: TVChannel) => {
    // GitHub raw URLs load directly — no proxy needed
    const logoUrl = channel.logoUrl || "";

    navigate({
      page: "live-tv-watch",
      channelId: channel.id,
      channelName: channel.name,
      channelCategory: channel.category,
      channelStreamCategory: "",
      channelCountryCode: channel.country.code,
      channelCountryName: channel.country.name,
      channelEmbedUrl: channel.embedUrl,
      channelDamitvDefaultUrl: "",
      channelViewers: 0,
      channelLogoUrl: logoUrl,
      channelDamitvResolveIdx: 0,
      channelDamitvEmbedUrl: channel.damitvEmbedUrl || "",
      channelDamitvId: channel.damitvId,
      channelDamitvResolveUrl: channel.damitvResolveUrl || "",
      channelStreamUrl: channel.streamUrl || "",
    });
  };

  const handleImgError = (channelId: string) => {
    setImgErrors(prev => new Set(prev).add(channelId));
  };

  const handleImgLoaded = (channelId: string) => {
    setLoadedImgs(prev => new Set(prev).add(channelId));
  };

  // ── Determine if we should show the grid ──
  // Show grid immediately if we have channels (from cache or from fetch)
  const showGrid = channels.length > 0;
  const showLoadingSpinner = loading && channels.length === 0;
  const showError = error && channels.length === 0;

  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-8" style={{ background: "linear-gradient(180deg, rgba(7,7,12,1) 0%, rgba(12,12,20,1) 30%, rgba(7,7,12,1) 100%)" }}>
      {/* Header */}
      <div className="px-4 lg:px-8 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-black text-white"
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              Live TV
            </h1>
            <p className="text-white/30 text-xs mt-0.5">
              {totalAll > 0 ? `${totalAll} channels` : "Loading..."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Background refresh indicator — subtle, not blocking */}
            {isBackgroundRefresh && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <div className="w-2.5 h-2.5 rounded-full border border-orange-500/30 border-t-orange-500 animate-spin" />
                <span className="text-[9px] text-white/25 font-bold">Updating</span>
              </div>
            )}

            {/* DamiTV badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[11px] font-bold text-orange-400" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
                DamiTV
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 lg:px-8 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
            style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category + Country Filters */}
      <div className="px-4 lg:px-8 mb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => { setSelectedCategory("all"); setSelectedCountry("all"); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedCategory === "all" && selectedCountry === "all"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.04]"
            }`}
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            All ({totalAll})
          </button>
          {categories.map(cat => {
            const color = CAT_COLORS[cat.name] || CAT_COLORS.General;
            const icon = CAT_ICONS[cat.name] || CAT_ICONS.General;
            const isActive = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(isActive ? "all" : cat.name)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "text-white shadow-lg"
                    : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.04]"
                }`}
                style={{
                  ...(isActive ? {
                    background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                    border: `1px solid ${color}35`,
                    boxShadow: `0 0 12px ${color}15`,
                  } : {}),
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                }}
              >
                <span className="text-xs">{icon}</span>
                {cat.name} ({cat.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Country filter row — horizontal scrollable buttons */}
      {countries.length > 0 && (
        <div className="px-4 lg:px-8 mb-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setSelectedCountry("all")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                selectedCountry === "all"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.04]"
              }`}
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
            >
              🌍 All Countries
            </button>
            {countries.map(c => {
              const isActive = selectedCountry === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCountry(isActive ? "all" : c.code)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? "text-white shadow-lg"
                      : "bg-white/[0.03] text-white/40 hover:text-white/60 hover:bg-white/[0.06] border border-white/[0.04]"
                  }`}
                  style={{
                    ...(isActive ? {
                      background: `linear-gradient(135deg, #3b82f625, #3b82f610)`,
                      border: `1px solid #3b82f635`,
                      boxShadow: `0 0 12px #3b82f615`,
                    } : {}),
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  }}
                >
                  <span className="text-xs">{c.flag}</span>
                  {c.name} ({c.count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Channel count */}
      <div className="px-4 lg:px-8 mb-3">
        <p className="text-white/20 text-[10px] font-bold" style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
          Showing {channels.length} channels
        </p>
      </div>

      {/* Loading State — ONLY shown on very first load with no cache */}
      {showLoadingSpinner && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
          </div>
          <p className="text-sm text-white/30">Loading channels...</p>
          <p className="text-[10px] text-white/15">Fetching from DamiTV CSV</p>
        </div>
      )}

      {/* Error State — ONLY shown when no channels at all */}
      {showError && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-5xl">📺</div>
          <p className="text-sm text-white/40">{error}</p>
          <button
            onClick={() => fetchChannels(true)}
            className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/50 text-[11px] font-bold hover:bg-white/[0.08]"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── CHANNEL CARDS ── ALWAYS visible once we have data */}
      {showGrid && (
        <div className="px-4 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {channels.map(channel => {
              const color = CAT_COLORS[channel.category] || CAT_COLORS.General;
              const hasValidLogo = channel.logoUrl && !imgErrors.has(channel.id);
              const isLogoLoaded = loadedImgs.has(channel.id);

              return (
                <button
                  key={channel.id}
                  onClick={() => handleWatch(channel)}
                  className="group relative flex flex-col rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.04] hover:shadow-2xl cursor-pointer text-left"
                  style={{
                    background: `linear-gradient(145deg, ${color}12, ${color}04, rgba(255,255,255,0.02))`,
                    border: `1px solid ${color}15`,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {/* Glow effect on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
                    style={{
                      background: `radial-gradient(ellipse at 50% 0%, ${color}15, transparent 70%)`,
                    }}
                  />

                  {/* Top section — logo area */}
                  <div className="relative h-[110px] sm:h-[120px] flex items-center justify-center overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Live badge top-left */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/90 text-white text-[8px] font-black uppercase tracking-wider shadow-lg shadow-red-600/30">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    </div>

                    {/* DamiTV badge top-right */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 backdrop-blur-sm">
                        DAMI
                      </span>
                    </div>

                    {/* Center — Logo with progressive loading */}
                    {/* Always render letter avatar as base layer, logo fades in on top */}
                    <div className="relative z-10 flex items-center justify-center">
                      {/* Letter avatar — always visible as fallback */}
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black transition-all duration-300 group-hover:scale-110"
                        style={{
                          background: `linear-gradient(135deg, ${color}30, ${color}12)`,
                          border: `1px solid ${color}25`,
                          color,
                          // Hide letter when logo is loaded
                          opacity: hasValidLogo && isLogoLoaded ? 0 : 1,
                          position: hasValidLogo ? "absolute" : "relative",
                        }}
                      >
                        {channel.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Logo image — loads on top of letter avatar */}
                      {hasValidLogo && (
                        <img
                          src={channel.logoUrl || ""}
                          alt={channel.name}
                          loading="lazy"
                          decoding="async"
                          className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg transition-all duration-300 group-hover:scale-110"
                          style={{
                            opacity: isLogoLoaded ? 1 : 0,
                            transition: "opacity 0.3s ease",
                          }}
                          onLoad={() => handleImgLoaded(channel.id)}
                          onError={() => handleImgError(channel.id)}
                        />
                      )}
                    </div>

                    {/* Country flag bottom-right */}
                    <div className="absolute bottom-1.5 right-1.5 z-10">
                      <span className="text-[12px]">{channel.country.flag}</span>
                    </div>
                  </div>

                  {/* Bottom section — name + meta */}
                  <div className="p-2.5 pt-1.5">
                    <p className="text-[11px] font-bold text-white/85 group-hover:text-white truncate leading-tight">
                      {channel.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${color}12`, color: `${color}99` }}
                      >
                        {channel.category}
                      </span>
                    </div>
                  </div>

                  {/* Gradient border glow on hover */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      border: `1px solid ${color}40`,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {channels.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">🔍</div>
              <p className="text-sm text-white/40">No channels found</p>
              <p className="text-[10px] text-white/20">Try adjusting your filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
