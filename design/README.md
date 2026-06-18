# Handoff: StonkTube — Creator Stock Sentiment Platform

## Overview
StonkTube is a web app that aggregates stock analysis from finance YouTubers. It tracks every stock "call" a creator makes in a video, scores its sentiment (bullish / neutral / bearish), and surfaces it three ways: a **Dashboard** of highlights, a sortable **Stocks** browse page, per-stock **Detail** pages with a price chart annotated by creator sentiment at the time of each video, a **Creators** directory, and a **video summary modal**.

Audience: casual retail investors. Tone: clean, modern, light theme with a playful "stonk" edge.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior, **not production code to copy directly**. The HTML uses an internal templating runtime (`support.js`, the `<x-dc>` / `<sc-for>` / `<sc-if>` tags) that is **specific to the prototyping environment** — do not port that runtime. Your task is to **recreate these designs in the target codebase's environment** (React, Vue, Svelte, SwiftUI, etc.) using its established patterns, component library, and data layer. If no codebase exists yet, React + TypeScript with a charting lib (Recharts / visx / lightweight-charts) is a reasonable default.

All synthetic data (prices, videos, sentiment) in the prototype is mock data generated client-side. In production this comes from your backend (price API + a pipeline that transcribes/【analyzes creator videos).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are specified below. Recreate the UI pixel-accurately using the codebase's libraries. Exact hex values, fonts, and sizes are listed in **Design Tokens**.

---

## Screens / Views

### 1. Global Nav (persistent top bar)
- **Layout**: Sticky top bar, 66px tall, `rgba(246,246,242,0.85)` + `backdrop-filter: blur(12px)`, bottom border `#ECEBE4`. Inner container max-width 1240px, 28px horizontal padding, flex row, 28px gap.
- **Left**: app icon (30px, 9px radius — see Assets) + wordmark "StonkTube" (Space Grotesk 700, 19px, letter-spacing -0.02em).
- **Nav links**: Dashboard / Stocks / Creators. Active = `#14151A` bg, white text, 8px radius, 7×13px padding, 600 weight. Inactive = `#6E6F78` text, 500 weight, hover → `#14151A`.
- **Right**: a search field placeholder (white, 1px `#ECEBE4` border, 10px radius, 230px wide, "Search ticker or creator", magnifier icon). No avatar.

### 2. Dashboard (Home)
- **Header**: H1 "What the creators are calling." (Space Grotesk 700, 42px, line-height 1.05, letter-spacing -0.03em), max-width 680px. No eyebrow or subtitle.
- **Stock pills row**: 4-column grid, 16px gap. Each pill is a white card (1px `#ECEBE4`, 16px radius, ~18px padding) showing: ticker (JetBrains Mono 600, 16px) + company name (12px `#9A9BA4`); a green/red "X% bullish" chip top-right; an inline SVG sparkline (38px tall, 2px stroke, colored by day change); price (JetBrains Mono 600, 18px) + change string colored green/red. Hover: `translateY(-3px)` + shadow `0 12px 28px -12px rgba(20,21,26,0.18)`. Click → stock detail. Pills shown: NVDA, GOOGL, COIN, SPACEX.
- **Body grid**: 2 columns `1.55fr 1fr`, 28px gap.
  - **Left — "Latest analysis" feed**: heading + "Across 6 creators". Column of video cards (see Component: Video Card).
  - **Right — two leaderboard cards** (white, 16px radius, 20px padding), stacked 24px gap:
    - **Most mentioned**: subtitle "Total mentions · last 30 days". Rows: rank, color dot (stock brand color), ticker + a thin progress bar (`#F0EFE8` track, brand-color fill, width = mentions/max), mention count right-aligned. Click → detail.
    - **Most bullish**: subtitle "Share of positive ratings". Rows: rank, ticker + verdict label (Strong buy / Buy / Mixed / Cautious), green progress bar (width = bullish %), bullish % right-aligned in `#0F9D63`.

### 3. Stocks (browse)
- **Header**: eyebrow "All tracked names" (`#4F46E5`, 13px, 600, uppercase, letter-spacing 0.08em) + H1 "Stocks".
- **Sort control**: "Sort by" label + pill buttons: Most mentioned / Most bullish / Top movers / Price / A–Z. Active = dark pill (`#14151A`, white). Inactive = white, 1px border, `#6E6F78`.
- **Table**: white card, 18px radius. Header row + data rows on a 6-column grid `2.2fr 1.1fr 0.9fr 1.4fr 0.9fr 0.9fr`, 16px gap, 16×22px row padding, row separators `#F3F2EC`. Columns:
  1. **Stock**: rounded-square logo tile (40px, 11px radius, brand bg, initials in Space Grotesk 700) + ticker (JetBrains Mono 600, 15px) + optional "Private" tag + "name · sector" (12.5px `#9A9BA4`, ellipsis).
  2. **Price** (right): 60×26 sparkline + price (JetBrains Mono 600, 14px).
  3. **30D** (right): % change, green/red.
  4. **Sentiment**: a stacked horizontal bar (8px tall, 5px radius) split bullish `#0F9D63` / neutral `#D9B26A` / bearish `#E5484D` by share, with "X% bullish" caption below.
  5. **Mentions** (right): count.
  6. **Creators** (right): distinct-creator count.
  - Row hover → `#FAFAF7`. Click → detail.

### 4. Stock Detail
- **Back link**: "‹ Dashboard".
- **Header row** (space-between): left = logo tile (54px, 14px radius) + ticker (JetBrains Mono 600, 24px) + optional "Private · Secondary" tag (`#8A6D3B` on `#FBF3E2`) + "name · sector". Right = price (JetBrains Mono 600, 30px) + today's change (green/red) + "Tracked by N creators".
- **Chart card** (white, 18px radius, ~22px padding):
  - **Top bar**: left = timeframe segmented control (1M / 3M / 6M / 1Y) in a `#F3F2EC` pill group; active tab = white with shadow. Right = legend chip "▸ Creator sentiment at time of video" style indicator (no mode toggle — markers are always avatars).
  - **Chart**: 360px tall responsive SVG (`viewBox 0 0 1000 360`, `preserveAspectRatio="none"`). Area fill = vertical gradient of stock brand color (0.16 → 0 opacity). Line = 2.4px stroke, brand color, `vector-effect: non-scaling-stroke`. 5 horizontal gridlines `#F0EFE8` with right-aligned price labels (JetBrains Mono 11px `#B6B7BE`). X-axis: 6 date ticks below.
  - **Creator markers (avatars)**: absolutely-positioned overlay on the chart, one per video that falls inside the timeframe, placed at (date → x, price-at-that-date → y). Each marker = a 34px circle avatar (creator initial, creator brand color, 2.5px white border, drop shadow) sitting above the price point, connected to it by a 2px vertical stem in the creator color + a small dot on the line. A **sentiment corner badge** (18px circle, green/amber/red, white thumbs-up/down/dash icon) overlaps the avatar's bottom-right.
  - **Hover tooltip** (per marker): dark card (`#14151A`, 12px radius, 218px) with creator avatar + name + date, a sentiment text badge, the video title, and "Price at mention · $X". Appears on marker hover, lifts up slightly.
- **Bottom grid** (`1.5fr 1fr`, 28px gap):
  - **Left — "Recent creator coverage"**: list of event cards (creator avatar, name + handle + date, video title, sentiment badge + "@ $price").
  - **Right — "Overall sentiment"** (sticky card, top 90px): "Based on N recent ratings", a big bullish % (Space Grotesk 700, 44px, `#0F9D63`) + verdict word, "of creators are bullish", a 10px stacked bull/neut/bear bar, then 3 legend rows with counts.

### 5. Creators (directory)
- **Header**: eyebrow "The Network" + H1 "Creators we track" + subtitle.
- **Grid**: 2 columns, 20px gap. Each **creator card** (white, 18px radius, 22px padding):
  - Header: 52px avatar (initial, brand color) + name (Space Grotesk 700, 17px) + "handle · subs subscribers" + a "Visit ↗" outline button linking to the YouTube channel (opens new tab).
  - Bio paragraph (13.5px `#6E6F78`).
  - Two stat tiles (`#F8F8F4`, 11px radius): "Videos tracked" count, "Bullish calls" % (`#0F9D63`).
  - "Covers TICKER · TICKER · …" line.
  - "Recent calls": up to 3 rows, each = small video thumbnail (66×37, brand bg, play glyph, duration badge) linking to YouTube + title (links to YouTube) + date + clickable stock chips.

### Component: Video Card (Latest analysis feed)
- White card, 1px `#ECEBE4`, 14px radius, 14px padding, flex row, 14px gap. Hover border `#D6D5CC`.
- **Thumbnail** (left, 176×99, 10px radius): brand-color background with a diagonal dark gradient overlay, the **primary ticker** large in translucent white (JetBrains Mono 700, 27px), the creator name bottom-left (uppercase 10px), a centered circular play button, and a duration badge bottom-right (`rgba(20,21,26,0.88)`). **The whole thumbnail is an `<a target="_blank">` to the YouTube video.**
- **Right column**: creator avatar (26px) + name + "· date"; video **title** (15px, 600) — also a link to YouTube, hover `#4F46E5`; bottom row = **stock chips** (one per mentioned stock, up to 5) on the left + a **"View full summary"** button on the right (`#4F46E5`, document icon).
- **Stock chip**: `#F3F2EC` bg, 1px `#ECEBE4`, 7px radius, ticker (JetBrains Mono 600, 12px) + a colored thumbs-up/down/dash icon by sentiment. **Clicking a chip navigates to that stock's detail page** (and must `stopPropagation` so it doesn't also trigger the card).

### Component: Video Summary Modal
- Triggered by "View full summary". Fixed overlay `rgba(20,21,26,0.5)` + blur, centered card (white, 20px radius, max-width 560px, max-height 88vh, scroll).
- **Header banner** (188px, creator brand color, dark gradient): large primary ticker, centered play button linking to YouTube, duration badge, close (×) button.
- **Body**: creator avatar + name + handle + full date; video title (Space Grotesk 700, 22px); "Summary" section (generated paragraph); "Key takeaways" — one row per mentioned stock with ticker + sentiment badge + a one-line note, each row **clickable to that stock's detail page** (closes modal first); a black "Watch full video on YouTube" button (YouTube glyph) linking out.

---

## Interactions & Behavior
- **Navigation** is a single-page state machine: `screen ∈ {home, stocks, stock, creators}` plus `cur` (current ticker), `tf` (timeframe in trading days: 22/66/132/260), `stkSort`, and `openVid` (the video shown in the modal). Recreate with your router or local view state.
- **External links** (video thumbnails, titles, "Visit", "Watch full video") open YouTube in a new tab (`target="_blank" rel="noopener"`). In the prototype these are YouTube search URLs; wire real video/channel URLs in production.
- **Stock chips** everywhere navigate to the stock detail page; stop event propagation when nested inside another clickable card.
- **Chart markers** show their tooltip on hover (opacity/visibility transition ~0.14s, slight upward translate). Markers reposition when the timeframe changes (only videos within the window are shown).
- **Hover states**: pills lift; cards darken border or background; nav/sort pills shift color. Durations 0.12–0.15s ease.
- **Modal**: click backdrop or × to close; inner card stops propagation.

## State Management
- `screen`, `cur` (ticker), `tf` (days), `stkSort` (mentions|bull|chg|price|ticker), `openVid` (video object | null).
- Derived per stock: latest price, day change %, sparkline points, sentiment counts (bull/neut/bear), distinct creator count, sorted event list.
- Data fetching (production): price time series (daily resolution) per ticker; creator videos with `{creator, date, title, mentions:[{ticker, sentiment}], url}`; channel metadata.

## Design Tokens
**Colors**
- Page bg `#F6F6F2`; nav bg `rgba(246,246,242,0.85)`; card bg `#FFFFFF`; tile/stat bg `#F8F8F4` / `#F3F2EC`.
- Text: primary `#14151A`, body `#23242B`/`#3A3B42`, muted `#6E6F78`, faint `#9A9BA4`, faintest `#B6B7BE`.
- Borders: `#ECEBE4` (card), `#F0EFE8` / `#F3F2EC` (separators), hover `#D6D5CC`.
- Accent (eyebrows, links): `#4F46E5` (hover `#3730A3`).
- Sentiment: bullish `#0F9D63` (bg `#E7F6EE`), neutral `#D9B26A` / amber text `#B7791F` (bg `#FBF3E2`), bearish `#E5484D` (bg `#FCEBEC`).
- Icon green (brand mark): `#23D17F` on dark, `#1AB46B` on light.
- Stock brand colors: NVDA `#76B900`/logo `#1A1A1A`, GOOGL `#4285F4`, COIN `#0052FF`, SPACEX `#5B6BD6`/logo `#15172B`, TSLA `#E31937`, MSTR `#F7931A`/logo `#0E1B33`.
- Creator brand colors: Bella `#DB2D7A`, MeiTouJun `#E0962B`, Joseph `#2563EB`, Andrei `#7C3AED`, Tom `#0D9488`, Kevin `#EA580C`.

**Typography**
- Display/headings: **Space Grotesk** (500–700).
- Body/UI: **Plus Jakarta Sans** (400–700).
- Numeric/tickers/prices: **JetBrains Mono** (400–600).
- Scale: H1 42/-0.03em; section H2 21/-0.02em; card H3 16; body 15–16; meta 12–13.5; micro 11–12.

**Radius**: pills/inputs 8–11px; cards 14–18px; app-icon tile 9px (nav) / 22px (app); avatars 50%.
**Shadow**: pill hover `0 12px 28px -12px rgba(20,21,26,0.18)`; modal `0 30px 80px -20px rgba(20,21,26,0.5)`; tooltip `0 12px 32px -8px rgba(20,21,26,0.4)`.
**Spacing**: container max-width 1240px, 28px gutters; grid gaps 16–28px.

## Assets
- **App icon** — `assets/stonktube-icon.svg` (dark tile) and `assets/stonktube-icon-light.svg` (light tile). The mark = a green "stonk" line rising behind a centered white play triangle, arrowhead at the top-right corner. Export to PNG at 16/32/48/180/192/512px for favicon + PWA/app icons. `StonkTube Icon.dc.html` shows three explored directions (A was chosen) plus the icon at real sizes.
- **Sentiment icons**: thumbs-up (bullish), thumbs-down (bearish), dash (neutral) — drawn inline as SVG paths in the prototype; substitute your icon set (e.g. Lucide `thumbs-up`/`thumbs-down`/`minus`).
- **Sparklines / price line / area**: plain SVG polylines in the prototype; in production use your charting library at **daily resolution**.
- **Video thumbnails / avatars**: the prototype renders colored placeholders with initials. Production should use real YouTube thumbnails and channel avatars.
- Fonts load from Google Fonts (Space Grotesk, Plus Jakarta Sans, JetBrains Mono).

## Files
- `TickerTube.dc.html` — the full app (Dashboard, Stocks, Stock Detail, Creators, Video Card, Summary Modal). All layout, copy, colors, and the mock-data generator live here. **This is the primary reference.** (Filename is legacy; the product is "StonkTube".)
- `StonkTube Icon.dc.html` — icon exploration + size/context showcase.
- `assets/stonktube-icon.svg`, `assets/stonktube-icon-light.svg` — the chosen app mark.
- `support.js` — the prototyping runtime. **Reference only — do not port.**

> To preview the HTML references, open the `.dc.html` files in a browser (they load `support.js` from the same folder). Treat the rendered result as the visual spec.
