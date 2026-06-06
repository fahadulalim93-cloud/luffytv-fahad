#!/usr/bin/env python3
"""
AnimeX.one M3U Scraper — Scrape m3u8/mp4 streams using AniList ID

Fetches ALL servers (Hard Sub, Soft Sub, Dub) from animex.one.

Usage:
    python3 animex_scraper.py <anilist_id> [options]

Examples:
    python3 animex_scraper.py 145064                    # JJK S2 — all episodes, all servers
    python3 animex_scraper.py 145064 --episodes 5       # Only episode 5
    python3 animex_scraper.py 145064 --dub-only         # Only dub streams
    python3 animex_scraper.py 145064 --sub-only         # Only sub streams
    python3 animex_scraper.py 145064 -o jjk_s2          # Custom output name
    python3 animex_scraper.py 145064 --json             # Also save raw JSON

Flow:
    1. Navigate animex.one anime page → extract encoded animeId + episode list
    2. For each episode, call /rest/api/servers → get available sub/dub providers
    3. For each provider, call /rest/api/sources → get m3u8/mp4 stream URL
    4. Generate .m3u playlist file with all streams
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Optional


# ─── AnimeX Scraper (DrissionPage-based, Cloudflare-bypassing) ────────────────

class AnimeXScraper:
    """Scrapes animex.one for m3u8/mp4 stream URLs using browser automation."""

    BASE_URL = "https://animex.one"
    API_BASE = "https://pp.animex.one"
    CHROME_PATH = "/home/z/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome"

    def __init__(self, headless: bool = True, timeout: int = 30):
        self.headless = headless
        self.timeout = timeout
        self.page = None

    # ── Browser lifecycle ──────────────────────────────────────────────────

    def start(self):
        from DrissionPage import ChromiumPage, ChromiumOptions

        co = ChromiumOptions()
        co.set_browser_path(self.CHROME_PATH)
        co.set_argument("--no-sandbox")
        co.set_argument("--disable-dev-shm-usage")
        co.set_argument("--disable-gpu")
        co.auto_port()
        if self.headless:
            co.headless(True)
        co.set_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
        self.page = ChromiumPage(co)
        print("[OK] Browser launched.")

    def stop(self):
        if self.page:
            try:
                self.page.quit()
            except Exception:
                pass
        print("[OK] Browser closed.")

    # ── API helpers ────────────────────────────────────────────────────────

    def _api_get(self, url: str) -> Optional[dict | list]:
        """Fetch a URL via the browser (bypasses CF, sends cookies)."""
        result = self.page.run_js(f'''
            return fetch("{url}", {{
                method: "GET",
                credentials: "include",
                headers: {{"Content-Type": "application/json"}}
            }})
            .then(r => r.json())
            .then(d => JSON.stringify(d))
            .catch(e => JSON.stringify({{__error: e.message}}));
        ''')
        if result is None:
            return None
        try:
            data = json.loads(result)
            if isinstance(data, dict) and "__error" in data:
                print(f"[WARN] API error: {data['__error']}")
                return None
            return data
        except json.JSONDecodeError:
            return None

    # ── Anime lookup ───────────────────────────────────────────────────────

    def get_anime_info(self, anilist_id: int) -> Optional[dict]:
        """Navigate to the anime page on animex.one and extract embedded data.

        animex.one supports URLs like /anime/-<anilist_id> which resolves
        to the correct anime page and embeds all metadata in SvelteKit data.

        Returns a dict with:
          - anime_id: the encoded ID used in API calls (e.g. "jujutsu-kaisen-season-2-ibd0a")
          - title: anime title
          - episodes: list of episode objects with number, hasSub, hasDub
          - anilist_id: the AniList ID
        """
        # Navigate directly using AniList ID — the site handles /anime/-<id>
        self.page.get(f"{self.BASE_URL}/anime/-{anilist_id}")
        time.sleep(8)

        # Check if page loaded correctly
        if "404" in self.page.title.lower() or "not found" in self.page.title.lower():
            print(f"[ERROR] Anime with AniList ID {anilist_id} not found on animex.one.", file=sys.stderr)
            return None

        # Extract the SvelteKit embedded data
        html = self.page.html

        # Find the encoded animeId (slug) — this is the ID used in API calls
        slug_matches = re.findall(r'slug:"([^"]+)"', html)
        slug = slug_matches[0] if slug_matches else None

        if not slug:
            # Fallback: extract from URL
            url_match = re.search(r'/anime/([^/?]+)', self.page.url)
            slug = url_match.group(1) if url_match else None

        if not slug:
            print(f"[ERROR] Could not extract anime ID from page.", file=sys.stderr)
            return None

        # Extract title
        title_match = re.search(r'titleEnglish:"([^"]+)"', html) or re.search(r'titleRomaji:"([^"]+)"', html)
        title = title_match.group(1) if title_match else "Unknown"

        # Extract episode count
        ep_count_match = re.search(r'episodeCount:(\d+)', html) or re.search(r'totalEpisodes:(\d+)', html)
        total_eps = int(ep_count_match.group(1)) if ep_count_match else None

        # Use the episodes API to get full episode list with hasSub/hasDub
        episodes_data = self._api_get(f"{self.API_BASE}/rest/api/episodes?id={slug}")

        episodes = []
        if isinstance(episodes_data, list):
            for ep in episodes_data:
                episodes.append({
                    "number": ep.get("number"),
                    "title": ep.get("titles", {}).get("en", f"Episode {ep.get('number')}"),
                    "hasSub": ep.get("hasSub", False),
                    "hasDub": ep.get("hasDub", False),
                    "isFiller": ep.get("isFiller", False),
                })
        elif total_eps:
            # Fallback: generate episode numbers
            for i in range(1, total_eps + 1):
                episodes.append({
                    "number": i,
                    "title": f"Episode {i}",
                    "hasSub": True,
                    "hasDub": False,
                    "isFiller": False,
                })

        return {
            "anime_id": slug,
            "anilist_id": anilist_id,
            "title": title,
            "episodes": episodes,
        }

    def get_servers(self, anime_id: str, ep_num: int) -> dict:
        """Fetch available sub/dub providers for an episode."""
        data = self._api_get(f"{self.API_BASE}/rest/api/servers?id={anime_id}&epNum={ep_num}")
        if isinstance(data, dict):
            return data
        return {"subProviders": [], "dubProviders": []}

    def get_sources(self, anime_id: str, ep_num: int, ep_type: str, provider_id: str) -> Optional[dict]:
        """Fetch stream sources for a specific episode+type+provider."""
        data = self._api_get(
            f"{self.API_BASE}/rest/api/sources?id={anime_id}&epNum={ep_num}&type={ep_type}&providerId={provider_id}"
        )
        if isinstance(data, dict) and "sources" in data:
            return data
        return None

    # ── Main scrape logic ─────────────────────────────────────────────────

    def scrape(
        self,
        anilist_id: int,
        episode_range: Optional[str] = None,
        sub_only: bool = False,
        dub_only: bool = False,
    ) -> dict:
        """Full scraping pipeline: AniList ID → all stream URLs."""
        print(f"\n{'=' * 60}")
        print(f"  AnimeX.one M3U Scraper")
        print(f"  AniList ID: {anilist_id}")
        print(f"{'=' * 60}\n")

        # Step 1: Launch browser
        self.start()

        try:
            # Step 2: Get anime info and episode list
            print(f"[INFO] Looking up anime with AniList ID {anilist_id} on animex.one...")
            anime_info = self.get_anime_info(anilist_id)
            if not anime_info:
                return {"anime_info": None, "streams": []}

            anime_id = anime_info["anime_id"]
            title = anime_info["title"]
            episodes = anime_info["episodes"]

            print(f"[OK] Found: {title}")
            print(f"[OK] Encoded ID: {anime_id}")
            print(f"[OK] Episodes: {len(episodes)}")

            # Apply episode range filter
            ep_nums = [ep["number"] for ep in episodes]
            if not ep_nums:
                ep_nums = list(range(1, 25))

            if episode_range:
                ep_nums = self._parse_episode_range(episode_range, max(ep_nums))

            print(f"[OK] Scraping episodes: {len(ep_nums)}")
            mode = "Sub+Dub" if not sub_only and not dub_only else ("Sub only" if sub_only else "Dub only")
            print(f"[OK] Mode: {mode}")
            print()

            # Step 3: Scrape each episode
            streams = []
            for idx, ep_num in enumerate(ep_nums, 1):
                # Get available servers
                servers = self.get_servers(anime_id, ep_num)
                sub_providers = servers.get("subProviders", [])
                dub_providers = servers.get("dubProviders", [])

                ep_streams = []

                # Scrape sub providers
                if not dub_only:
                    for prov in sub_providers:
                        prov_id = prov.get("id", "")
                        tip = prov.get("tip", "")
                        is_default = prov.get("default", False)

                        source = self.get_sources(anime_id, ep_num, "sub", prov_id)
                        if source and source.get("sources"):
                            for s in source["sources"]:
                                ep_streams.append({
                                    "episode": ep_num,
                                    "url": s["url"],
                                    "quality": s.get("quality", "auto"),
                                    "stream_type": s.get("type", ""),
                                    "audio": "Sub",
                                    "provider": prov_id,
                                    "provider_tip": tip,
                                    "is_default": is_default,
                                    "chapters": source.get("chapters"),
                                })
                        time.sleep(0.5)

                # Scrape dub providers
                if not sub_only:
                    for prov in dub_providers:
                        prov_id = prov.get("id", "")
                        tip = prov.get("tip", "")
                        is_default = prov.get("default", False)

                        source = self.get_sources(anime_id, ep_num, "dub", prov_id)
                        if source and source.get("sources"):
                            for s in source["sources"]:
                                ep_streams.append({
                                    "episode": ep_num,
                                    "url": s["url"],
                                    "quality": s.get("quality", "auto"),
                                    "stream_type": s.get("type", ""),
                                    "audio": "Dub",
                                    "provider": prov_id,
                                    "provider_tip": tip,
                                    "is_default": is_default,
                                    "chapters": source.get("chapters"),
                                })
                        time.sleep(0.5)

                if ep_streams:
                    streams.extend(ep_streams)
                    for s in ep_streams:
                        url_short = s["url"][:70] + "…" if len(s["url"]) > 70 else s["url"]
                        st = s.get("stream_type", "")
                        if "mpegurl" in st or ".m3u8" in s["url"]:
                            fmt = "m3u8"
                        elif "dash" in st or ".mpd" in s["url"]:
                            fmt = "mpd"
                        elif "mp4" in st or ".mp4" in s["url"]:
                            fmt = "mp4"
                        else:
                            fmt = st.split("/")[-1] if "/" in st else "?"
                        default_tag = " ★" if s["is_default"] else ""
                        print(f"  [{idx:>3}/{len(ep_nums)}] EP {ep_num:>3} [{s['audio']:>3}] [{s['provider']}] {fmt} {url_short}{default_tag}")
                else:
                    print(f"  [{idx:>3}/{len(ep_nums)}] EP {ep_num:>3}  — no streams found")

        finally:
            self.stop()

        return {
            "anime_info": anime_info,
            "streams": streams,
        }

    @staticmethod
    def _parse_episode_range(range_str: str, total: int) -> list:
        episodes = []
        for part in range_str.split(","):
            part = part.strip()
            if "-" in part:
                a, b = part.split("-", 1)
                episodes.extend(range(int(a), min(int(b) + 1, total + 1)))
            else:
                ep = int(part)
                if 1 <= ep <= total:
                    episodes.append(ep)
        return sorted(set(episodes))


# ─── M3U Playlist Generator ───────────────────────────────────────────────────

def generate_m3u(anime_info: dict, streams: list, output_path: str) -> str:
    """Write an .m3u playlist file from the scraped streams."""
    title = anime_info.get("title", "Unknown")

    lines = ["#EXTM3U"]

    for s in sorted(streams, key=lambda x: (x.get("episode", 0), x.get("audio", ""), x.get("provider", ""))):
        ep = s["episode"]
        audio = s["audio"]
        prov = s["provider"]
        tip = s.get("provider_tip", "")
        label = f"{title} - EP {ep} ({audio}) [{prov}]"
        if tip:
            label += f" - {tip}"
        lines.append(f"#EXTINF:-1,{label}")
        lines.append(s["url"])

    content = "\n".join(lines) + "\n"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(content, encoding="utf-8")
    return output_path


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape animex.one m3u8/mp4 streams using an AniList anime ID",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  %(prog)s 145064                       JJK S2 — all episodes, all servers
  %(prog)s 145064 -e 5                  Only episode 5
  %(prog)s 145064 --sub-only            Only sub (hard+soft) streams
  %(prog)s 145064 --dub-only            Only dub streams
  %(prog)s 145064 -o jjk_s2             Custom output filename
  %(prog)s 145064 --json                Also save raw JSON
        """,
    )
    parser.add_argument("anilist_id", type=int, help="AniList anime ID")
    parser.add_argument("-o", "--output", type=str, default=None,
                        help="Output filename (without .m3u extension)")
    parser.add_argument("-e", "--episodes", type=str, default=None,
                        help="Episode range, e.g. '1-12' or '1,3,5-8'")
    parser.add_argument("--sub-only", action="store_true", help="Only scrape sub streams")
    parser.add_argument("--dub-only", action="store_true", help="Only scrape dub streams")
    parser.add_argument("--no-headless", action="store_true", help="Show browser window (debug)")
    parser.add_argument("--json", action="store_true", help="Also save raw JSON output")
    parser.add_argument("--timeout", type=int, default=30, help="Browser timeout (seconds)")

    args = parser.parse_args()
    output_dir = Path("/home/z/my-project/download")

    scraper = AnimeXScraper(headless=not args.no_headless, timeout=args.timeout)

    try:
        result = scraper.scrape(
            anilist_id=args.anilist_id,
            episode_range=args.episodes,
            sub_only=args.sub_only,
            dub_only=args.dub_only,
        )
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Stopping…")
        scraper.stop()
        sys.exit(1)
    except Exception as exc:
        print(f"\n[ERROR] {exc}", file=sys.stderr)
        scraper.stop()
        sys.exit(1)

    streams = result["streams"]
    anime_info = result.get("anime_info") or {}

    if not streams:
        print("\n[ERROR] No streams found.", file=sys.stderr)
        sys.exit(1)

    # Build output filename
    title = anime_info.get("title", f"anilist_{args.anilist_id}")
    safe = re.sub(r"[^\w\s-]", "", title).strip().replace(" ", "_")
    name = args.output or safe
    m3u_path = str(output_dir / f"{name}.m3u")

    generate_m3u(anime_info, streams, m3u_path)

    # Summary
    sub_count = sum(1 for s in streams if s["audio"] == "Sub")
    dub_count = sum(1 for s in streams if s["audio"] == "Dub")
    providers = sorted(set(s["provider"] for s in streams))
    m3u8_count = sum(1 for s in streams if ".m3u8" in s["url"])
    mp4_count = sum(1 for s in streams if ".mp4" in s["url"])
    mpd_count = sum(1 for s in streams if ".mpd" in s["url"])

    print(f"\n{'=' * 60}")
    print(f"  M3U playlist saved → {m3u_path}")
    print(f"  Total streams: {len(streams)}  (Sub: {sub_count}, Dub: {dub_count})")
    print(f"  Formats: m3u8={m3u8_count}, mp4={mp4_count}, mpd={mpd_count}")
    print(f"  Providers: {', '.join(providers)}")
    print(f"{'=' * 60}")

    if args.json:
        json_path = str(output_dir / f"{name}.json")
        Path(json_path).write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  JSON data saved → {json_path}")


if __name__ == "__main__":
    main()
