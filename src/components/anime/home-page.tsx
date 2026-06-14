"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "./store";

/* ─── Scroll reveal observer hook ─── */
function useLunarReveal() {
  useEffect(() => {
    const sections = document.querySelectorAll(".lunar-section");
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lunar-visible");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);
}

/* ─── Animated count-up hook ─── */
function useCountUp(target: number, duration: number = 2000, started: boolean = false) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(started);

  useEffect(() => {
    startedRef.current = started;
    if (!started) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      if (!startedRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [started, target, duration]);

  const effectiveCount = started ? count : 0;
  return effectiveCount;
}

/* ─── CountUp display component ─── */
function CountUpValue({ target, suffix, duration, started }: {
  target: number; suffix?: string; duration?: number; started: boolean;
}) {
  const count = useCountUp(target, duration || 2000, started);
  const formatted = count.toLocaleString();
  return <>{formatted}{suffix || ""}</>;
}

/* ─── Ticker items — anime, movies, sports ─── */
const tickerItems = [
  "Naruto ナルト",
  "Jujutsu Kaisen 呪術廻戦",
  "One Piece ワンピース",
  "Demon Slayer 鬼滅の刃",
  "Attack on Titan 進撃の巨人",
  "Spider-Man: Across the Spider-Verse",
  "Oppenheimer",
  "Dune: Part Two",
  "Premier League Live",
  "Champions League",
  "NBA Finals",
  "F1 Racing",
  "Dragon Ball ドラゴンボール",
  "Bleach ブリーチ",
];

/* ─── Stats data — GOLD THEME ─── */
const stats = [
  { targetValue: 10000, suffix: "+", label: "TITLES", color: "#D4A017" },
  { targetValue: 5000, suffix: "+", label: "MOVIES", color: "#E8B923" },
  { targetValue: 0, suffix: "", displayText: "ZERO", label: "ADS", color: "#C9961A" },
  { targetValue: 4, suffix: "K", label: "QUALITY", color: "#F5C842" },
];

/* ─── Features data — All-In-One — GOLD THEME ─── */
const features = [
  { icon: "▶", title: "Watch Together", desc: "Host synced watch parties for anime, movies, and shows. Real-time playback, shared reactions, and group controls across every category.", tag: "SOCIAL", tagColor: "#D4A017", iconBg: "rgba(212,160,23,0.12)" },
  { icon: "💬", title: "Live Chat & Reactions", desc: "Drop messages, emojis, and instant reactions while watching anything. Engage with the community in episode discussions and live comment streams.", tag: "COMMUNITY", tagColor: "#E8B923", iconBg: "rgba(232,185,35,0.12)" },
  { icon: "✦", title: "Full Customization", desc: "Custom avatars, themes, profile layouts, and personalized watchlists. Build your streaming identity across anime, movies, and TV.", tag: "PERSONAL", tagColor: "#C9961A", iconBg: "rgba(201,150,26,0.12)" },
  { icon: "⚡", title: "Live Sports & TV", desc: "Stream live sports events and TV channels from around the world. Real-time scores, multi-source playback, and instant channel switching.", tag: "LIVE", tagColor: "#ef4444", iconBg: "rgba(239,68,68,0.12)" },
  { icon: "言", title: "Multi-Language", desc: "Subtitles and dubs in 20+ languages with community-driven translations. Watch any content in the language that feels right.", tag: "ACCESSIBILITY", tagColor: "#10b981", iconBg: "rgba(16,185,129,0.12)" },
  { icon: "⟳", title: "Cross-Device Sync", desc: "Seamlessly switch between phone, tablet, laptop, and desktop. Your watch progress, queue, and settings follow you everywhere.", tag: "TECHNICAL", tagColor: "#D4A017", iconBg: "rgba(212,160,23,0.12)" },
];

/* ─── Breakdown data — All-In-One — GOLD THEME ─── */
const breakdowns = [
  {
    title: "Social",
    color: "#D4A017",
    items: [
      "Watch parties with synced playback for up to 50 users",
      "Live comments & reactions on any content",
      "Community rooms for anime, movies & sports",
      "Friends system with shared watchlists",
      "Group scheduling & watch reminders",
    ],
  },
  {
    title: "Personal",
    color: "#E8B923",
    items: [
      "Custom avatars, themes & animated profiles",
      "XP leveling with achievements & badges",
      "Smart history with auto-resume on any device",
      "AI-powered recommendations across all genres",
      "Personalized queue & notification management",
    ],
  },
  {
    title: "Technical",
    color: "#C9961A",
    items: [
      "4K Ultra HD with adaptive bitrate streaming",
      "Fast load times with global CDN distribution",
      "Multiple server options with auto-failover",
      "Native apps for iOS, Android & smart TVs",
      "Offline downloads with auto-expiry",
    ],
  },
];

/* ─── Twinkling Stars for Hero ─── */
function HeroStars() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    dur: `${2 + Math.random() * 4}s`,
    delay: `${Math.random() * 3}s`,
    size: Math.random() > 0.7 ? "2px" : "1px",
  }));

  return (
    <>
      {stars.map((s) => (
        <div
          key={s.id}
          className="lunar-star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            "--twinkle-dur": s.dur,
            "--twinkle-delay": s.delay,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/* ─── Stats section with count-up animation ─── */
function StatsSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="lunar-section py-20 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center py-4">
            <div
              className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 obsidian-stat-num"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif", color: stat.color }}
            >
              {stat.displayText ? (
                <span className={visible ? "lunar-count-pop" : "opacity-0"}>{stat.displayText}</span>
              ) : (
                <CountUpValue target={stat.targetValue} suffix={stat.suffix} duration={2500} started={visible} />
              )}
            </div>
            <div
              className="text-[10px] font-bold tracking-[0.12em] uppercase"
              style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", color: "#888888" }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN HOME PAGE COMPONENT — Golden Obsidian Aesthetic
   ═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const navigate = useAppStore(s => s.navigate);
  useLunarReveal();

  return (
    <div className="relative">

      {/* ══════════════════════════════════════════
          SECTION 1: HERO — Video Inside Text Centerpiece
          ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: "100vh" }}>
        {/* Layer 1: Video playing full screen */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          src="/hero-bg.mp4"
        />

        {/* Layer 2: Gold ambient glow behind text area — with pulse */}
        <div
          className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full pointer-events-none obsidian-glow-pulse"
          style={{ background: "radial-gradient(ellipse, rgba(212,160,23,0.22) 0%, rgba(201,150,26,0.08) 40%, transparent 70%)", filter: "blur(60px)" }}
        />

        {/* Twinkling stars */}
        <HeroStars />

        {/* Layer 3: Black overlay with white text — mix-blend-mode: multiply — MOVED UP */}
        <div
          className="absolute inset-0 z-[2] flex items-start justify-center pt-[15vh]"
          style={{ backgroundColor: "#000000", mixBlendMode: "multiply" }}
        >
          <h1
            className="font-black tracking-tight text-white leading-none select-none"
            style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif", fontSize: "clamp(60px, 12vw, 180px)" }}
          >
            LUFFY TV
          </h1>
        </div>

        {/* Layer 4: Light sweep across text */}
        <div className="hero-light-sweep" />

        {/* Layer 5: Top/bottom gradients for smooth blending — TALLER bottom */}
        <div className="absolute inset-0 z-[3] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[450px] bg-gradient-to-t from-black via-black/80 to-transparent" />
        </div>

        {/* Layer 6: Content below — tagline, description, buttons — pushed down */}
        <div className="absolute bottom-0 left-0 right-0 z-[5] text-center pb-32 px-6">
          <p
            className="text-white/40 text-sm tracking-widest uppercase mb-4"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
          >
            Free · Ad-Free · Always
          </p>
          <h2
            className="text-2xl sm:text-4xl font-bold text-white/80 mb-3"
            style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
          >
            Your Streaming Universe
          </h2>
          <p
            className="text-white/35 max-w-lg mx-auto mb-8 text-sm leading-relaxed"
            style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
          >
            Stream anime, movies, TV shows, and live sports in up to 4K with zero ads. Watch together, chat in real-time, and build your community.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="px-8 py-3.5 rounded-full text-black font-bold text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(212,160,23,0.5)]"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif", background: "linear-gradient(135deg, #D4A017, #F5C842)" }}
              onClick={() => navigate({ page: "watchnow" })}
            >
              Start Watching Free
            </button>
            <button
              className="px-8 py-3.5 rounded-full bg-white/5 text-white font-bold text-sm tracking-wide border border-white/10 hover:bg-white/10 hover:border-[#D4A017]/30 transition-all hover:-translate-y-0.5"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
              onClick={() => navigate({ page: "watchnow" })}
            >
              Browse Catalog
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2: SUBTLE CONTENT TICKER
          ══════════════════════════════════════════ */}
      <div className="bg-[#080808] border-y border-white/[0.04] overflow-hidden flex items-center">
        <div
          className="shrink-0 px-5 py-3 flex items-center gap-2 border-r border-white/[0.06]"
          style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4A017] animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/30">NOW STREAMING</span>
        </div>
        <div className="lunar-ticker-track py-3">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 px-5 text-[13px] text-white/40 font-medium whitespace-nowrap"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
            >
              {item}
              <span className="text-[#D4A017]/30">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SECTION 3: STATS
          ══════════════════════════════════════════ */}
      <section className="bg-[#080808]">
        <StatsSection />
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4: FEATURES — Modern Card Design — GOLD
          ══════════════════════════════════════════ */}
      <section id="features-section" className="lunar-section py-24 px-6 max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="mb-14">
          <span
            className="text-[11px] font-bold tracking-[0.14em] uppercase block mb-4"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", color: "#888888" }}
          >
            02 — Everything You Need
          </span>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05]"
            style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
          >
            <span className="text-[#f0f0f0]">Built For</span>
            <span className="mx-3" style={{ color: "#D4A017" }}>/</span>
            <span className="stroke-text-gold">Everyone</span>
          </h2>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="obsidian-feature-card group p-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.06] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.10] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] relative overflow-hidden"
              style={{ "--accent-color": feat.tagColor } as React.CSSProperties}
            >
              {/* Left border accent on hover */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: feat.tagColor }}
              />

              {/* Icon + Tag row */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: feat.iconBg, color: feat.tagColor }}
                >
                  {feat.icon}
                </div>
                <span
                  className="text-[10px] font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full"
                  style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", color: feat.tagColor, background: `${feat.tagColor}10`, border: `1px solid ${feat.tagColor}20` }}
                >
                  {feat.tag}
                </span>
              </div>

              {/* Title */}
              <h3
                className="text-base font-bold text-[#f0f0f0] mb-2"
                style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
              >
                {feat.title}
              </h3>

              {/* Description */}
              <p
                className="text-[13px] leading-relaxed"
                style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif", color: "#888888" }}
              >
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5: FEATURE BREAKDOWN — 3 columns — GOLD
          ══════════════════════════════════════════ */}
      <section className="lunar-section py-24 px-6 max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="mb-14">
          <span
            className="text-[11px] font-bold tracking-[0.14em] uppercase block mb-4"
            style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", color: "#888888" }}
          >
            03 — Feature Breakdown
          </span>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05]"
            style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
          >
            <span className="text-[#f0f0f0]">Every</span>
            <span className="mx-3" style={{ color: "#D4A017" }}>/</span>
            <span className="stroke-text-gold">Detail</span>
          </h2>
        </div>

        {/* Breakdown Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {breakdowns.map((col) => (
            <div key={col.title} className="border-t-2 pt-6" style={{ borderColor: `${col.color}30` }}>
              <h3
                className="text-base font-bold mb-4"
                style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif", color: col.color }}
              >
                {col.title}
              </h3>
              <div className="h-px mb-5" style={{ background: `${col.color}15` }} />
              <ul className="space-y-3">
                {col.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                      style={{ background: col.color, opacity: 0.6 }}
                    />
                    <span
                      className="text-[13px] leading-relaxed"
                      style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif", color: "#888888" }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6: CTA — "Ready To Dive In?" — GOLD
          ══════════════════════════════════════════ */}
      <section className="lunar-section py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Large stacked text */}
          <h2
            className="mb-6 leading-[1.05]"
            style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
          >
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-black text-[#f0f0f0]">
              Ready To
            </span>
            <span
              className="block text-5xl sm:text-6xl lg:text-7xl font-black mt-1"
              style={{
                color: "#D4A017",
                textShadow: "0 0 40px rgba(212,160,23,0.3), 0 0 80px rgba(212,160,23,0.15)"
              }}
            >
              Dive In?
            </span>
            <span className="block text-5xl sm:text-6xl lg:text-7xl font-black mt-1 stroke-text-gold">
              Join Us.
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="text-[15px] mb-10 max-w-md mx-auto"
            style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif", color: "#888888" }}
          >
            Join thousands of fans streaming anime, movies, TV shows, and live sports for free. No ads, no sign-up required.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              className="px-8 py-3.5 rounded-full text-black font-bold text-sm tracking-wide transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(212,160,23,0.5)]"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif", background: "linear-gradient(135deg, #D4A017, #F5C842)" }}
              onClick={() => navigate({ page: "watchnow" })}
            >
              Start Watching Free
            </button>
            <button
              className="px-8 py-3.5 rounded-full bg-white/5 text-white font-bold text-sm tracking-wide border border-white/10 hover:bg-white/10 hover:border-[#D4A017]/30 transition-all hover:-translate-y-0.5"
              style={{ fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
              onClick={() => navigate({ page: "watchnow" })}
            >
              Browse Catalog
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
