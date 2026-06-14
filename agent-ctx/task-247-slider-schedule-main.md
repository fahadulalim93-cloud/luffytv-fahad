# Task: Redesign 24/7 Streams as Full-Width Hero Slider + Add Schedule Page

## Summary

Successfully completed all requested changes:

### 1. Redesigned 24/7 Streams Section
- **Replaced `Stream247Card`** component (lines 234-300) with a full-width hero slider card:
  - Full-width banner (200px mobile, 240px tablet, 280px desktop)
  - Large gradient background with stream color
  - Large watermark icon (opacity 0.04, subtle)
  - Left side: LIVE 24/7 badge, channel name (big bold), description, category badge
  - Watch Now button with play icon and glow effect
  - New `isActive` prop for animation transitions

- **Added slider state and auto-rotate logic**:
  - `slider247Index` state variable
  - Auto-rotate useEffect with 5-second interval
  - Cleans up interval on unmount

- **Replaced 24/7 rendering section** with full-width hero carousel:
  - Shows ONE stream at a time (block/hidden toggle)
  - Navigation arrows on left/right edges (only when >1 stream)
  - Dot indicators at bottom center (active dot is wider, purple)
  - Smooth transitions

### 2. Created Schedule Page (`live-schedule-page.tsx`)
- New file at `/home/z/my-project/src/components/anime/live-schedule-page.tsx`
- Fetches matches from `/api/live` API
- Displays matches grouped by date (Today, Tomorrow, then actual dates)
- Each match shows: time, sport icon/badge, match title, league, LIVE badge if active
- Sport filter tabs matching the site's design language
- "Watch Live" button for live matches, "Remind" for upcoming
- Dark theme consistent with the rest of the site

### 3. Updated Store Navigation
- Added `{ id: "schedule", label: "Schedule" }` to `getSectionNavLinks` for live section in `store.ts`

### 4. Updated Live Page Routing
- Added `import LiveSchedulePage from "./live-schedule-page"`
- Added `sectionSubPage === "schedule"` conditional render
- Added Schedule tab button in the sticky nav bar (amber-500 style)

### 5. Files Modified
- `/home/z/my-project/src/components/anime/live-page.tsx` (Stream247Card, slider, schedule routing, tab)
- `/home/z/my-project/src/components/anime/store.ts` (nav links)
- `/home/z/my-project/src/components/anime/live-schedule-page.tsx` (new file)

### Build & Deploy
- Build passed successfully with `npx next build`
- Pushed to both remotes: `origin main` and `tasin main`
