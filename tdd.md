# StonkTube — Technical Design Document

> Aggregates stock analysis from finance YouTubers: tracks every "call" a creator makes in a video, scores its sentiment (bullish / neutral / bearish), and surfaces it across a Dashboard, a Stocks browse page, per-stock Detail pages (price chart annotated with creator sentiment at the time of each video), a Creators directory, and a video-summary modal.
>
> Status: **Design** · Target platform: **Railway** · Primary reference: `design/README.md` + `design/TickerTube.dc.html`

---

## 1. Goals & Non-Goals

### Goals
- Continuously ingest videos from a curated set of finance YouTube channels.
- Transcribe each video and use an LLM to extract structured **stock mentions** (ticker + sentiment + supporting note) plus a human-readable **summary** and **key takeaways**.
- Maintain daily price time series for every tracked ticker, including private names (e.g. SPACEX secondary-market marks).
- Serve a fast read API to the frontend that powers the five screens defined in the design (pixel-accurate to `design/README.md`).
- Run the whole ingestion pipeline on a schedule with no manual intervention, deployed on Railway.

### Non-Goals (v1)
- No user accounts, auth, watchlists, or personalization. The site is read-only and public.
- No real-time/intraday data — **daily resolution** prices and near-real-time (hourly) video ingestion are sufficient.
- No trading, brokerage, or portfolio features.
- No mobile native apps (responsive web only).
- No creator-facing dashboard or moderation UI in v1 (admin actions are run via scripts/CLI).

---

## 2. System Overview

```
                         ┌────────────────────────────────────────────────┐
                         │                  Railway project                │
                         │                                                  │
  YouTube Data API ─────▶│  ┌─────────────┐   enqueue   ┌───────────────┐  │
  Transcript / Whisper ─▶│  │  Scheduler  │────────────▶│  Redis (BullMQ │  │
  Anthropic Claude   ───▶│  │ (cron svc)  │             │   job queues)  │  │
  Market-data API    ───▶│  └─────────────┘             └───────┬────────┘  │
                         │                                      │ consume    │
                         │  ┌─────────────┐   read/write  ┌─────▼────────┐   │
        Browser ◀────────│  │  API/Web    │◀─────────────▶│   Workers    │   │
                         │  │  (Fastify + │               │ (pipeline)   │   │
                         │  │  static SPA)│               └─────┬────────┘   │
                         │  └──────┬──────┘                     │            │
                         │         │           read/write       │            │
                         │         └──────────┬─────────────────┘            │
                         │              ┌─────▼──────┐                       │
                         │              │   Redis    │                       │
                         │              └────────────┘                       │
                         └──────────────────────┬─────────────────────────┘
                                                │ TLS (SRV connection string)
                                       ┌────────▼─────────┐
                                       │  MongoDB Atlas   │  (managed, external)
                                       │  replica set     │
                                       └──────────────────┘
```

Three deployable services in one Railway project, Redis as a Railway plugin, and **MongoDB Atlas** as an external managed datastore:

| Service | Role | Hosting |
|---|---|---|
| **web** | Fastify API + serves the built SPA | Railway web service (public domain) |
| **worker** | BullMQ consumers running the ingestion pipeline | Railway worker service (no domain) |
| **scheduler** | Enqueues recurring jobs on a cron schedule | Railway cron service |
| **mongodb** | Primary datastore | **MongoDB Atlas** (external, managed — replica set, backups) |
| **redis** | Job queue + cache | Railway Redis plugin |

A **single TypeScript monorepo** backs all three app services so types (especially API/DB models) are shared end to end.

---

## 3. Tech Stack & Rationale

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language, shared types between API and frontend via a `packages/shared` workspace. |
| Monorepo | **pnpm workspaces** + Turborepo | Cheap incremental builds; clean dependency boundaries. |
| Frontend | **React 18 + Vite** | Matches design's stated default; fast dev/build. |
| Styling | **Tailwind CSS** with a custom theme mapping the design tokens (§9) | Tokens are exact hex/spacing values — encode them once as theme config. |
| Data fetching | **TanStack Query** | Caching, background refetch, request dedup for the read-heavy UI. |
| Routing | **React Router** | Maps to the design's `screen` state machine (`/`, `/stocks`, `/stocks/:ticker`, `/creators`). |
| Charts | Custom **SVG** for the price+sparkline chart (the design requires avatar markers absolutely-positioned over a gradient area line — not a stock chart-lib feature). `visx` scales (`scaleTime`/`scaleLinear`) for math only. | Full control over the bespoke marker/tooltip overlay; sparklines are trivial polylines. |
| API server | **Fastify** | Fast, first-class TS, schema-based validation/serialization. |
| ODM | **Mongoose** | Type-safe schemas/models, hooks, and indexes over the native driver; Zod still validates external payloads at the boundary. (Prisma's Mongo connector is weaker on `$lookup`/aggregation — skip it.) |
| DB | **MongoDB Atlas** (managed, replica set) | A video + its summary + its mentions is naturally one document; aggregation pipeline handles leaderboards/sentiment splits well. Atlas gives transactions, backups, and HA without ops overhead. Daily price series uses a native **time-series collection**. |
| Queue | **BullMQ** on Redis | Durable jobs, retries with backoff, rate limiting, concurrency control. |
| LLM | **Anthropic Claude** — `claude-haiku-4-5` for extraction (cheap, high volume), escalate to `claude-opus-4-8` for long/ambiguous transcripts | Structured **tool-use** gives strict JSON output; Haiku keeps per-video cost low. |
| Transcription | YouTube caption track first; **Whisper** (Deepgram or `whisper.cpp`/OpenAI) fallback | Captions are free and instant when present; fallback covers videos without them. |
| Market data | Pluggable provider behind an interface (default **Financial Modeling Prep** or **Polygon.io**) | Daily OHLC for public tickers; private names handled separately (§6.4). |
| Validation | **Zod** | Runtime validation of external payloads (YouTube, LLM, price API) at the boundary. |

> LLM note: extraction uses Claude tool-use with a fixed schema so the model returns validated JSON, not prose. Default to the latest models above; `claude-haiku-4-5` is the workhorse and `claude-opus-4-8` is the escalation path for transcripts that fail schema validation or exceed a length/ambiguity threshold.

---

## 4. Repository Layout

```
stonktube/
├─ apps/
│  ├─ web/                 # React + Vite SPA (the design)
│  ├─ api/                 # Fastify server; also serves apps/web build in prod
│  ├─ worker/             # BullMQ consumers (pipeline stages)
│  └─ scheduler/           # cron entrypoint: enqueues recurring jobs
├─ packages/
│  ├─ shared/              # Zod schemas, TS types, sentiment enums, DTOs
│  ├─ db/                  # Mongoose connection, models, indexes, seed
│  └─ pipeline/            # ingestion logic: youtube, transcribe, analyze, prices
├─ design/                 # design references (read-only)
├─ railway.json            # service + build config
├─ turbo.json
├─ pnpm-workspace.yaml
└─ tdd.md
```

`apps/api` and `apps/worker` both depend on `packages/{db,shared,pipeline}`. The scheduler is a thin process that only depends on `packages/shared` (queue names) + BullMQ.

---

## 5. Data Model

MongoDB via Mongoose. Sentiment is a 3-value string enum used throughout: `BULLISH | NEUTRAL | BEARISH`. Five collections. Mongo's `_id` (ObjectId) is each document's PK; references are stored as ObjectIds.

**Modeling principle:** a `Mention` only ever exists inside the context of its video, so mentions are **embedded** in the `video` document rather than living in their own collection — this removes the hot-path join entirely. The Stock Detail page ("all coverage of NVDA") is then a single `find({ "mentions.stockId": … })` against a multikey index. Reference data (`stocks`, `creators`) lives in small standalone collections; selected display fields are denormalized onto embedded mentions to avoid lookups on read.

### 5.1 Collections

**`creators`** — a tracked YouTube channel.
| field | type | notes |
|---|---|---|
| `_id` | ObjectId | |
| `slug` | string, unique index | e.g. `bella`, used in URLs |
| `name` | string | "Bella Finance" |
| `handle` | string | "@bellafinance" |
| `youtubeChannelId` | string, unique index | source of truth for ingestion |
| `channelUrl` | string | |
| `avatarUrl` | string? | real YT avatar; fallback to initial+color |
| `brandColor` | string | hex, e.g. `#DB2D7A` |
| `initial` | string | display initial / glyph |
| `subscriberCount` | number? | raw; UI formats to "612K" |
| `bio` | string | |
| `language` | string | `en`, `zh`, … (drives transcription/extraction prompt) |
| `isActive` | boolean | pauses ingestion without deleting |
| `createdAt`/`updatedAt` | Date | Mongoose timestamps |

**`stocks`** — a tracked ticker (public or private).
| field | type | notes |
|---|---|---|
| `_id` | ObjectId | |
| `ticker` | string, unique index | `NVDA`, `SPACEX` |
| `name` | string | "NVIDIA Corp" |
| `sector` | string | |
| `aliases` | string[] | for LLM ticker resolution ("Nvidia", "英伟达") |
| `isPrivate` | boolean | SPACEX → true (drives "Private" tag + price source) |
| `brandColor` | string | line/area + logo color |
| `logoBg` | string | logo tile bg |
| `initials` | string | "NV" |
| `logoUrl` | string? | optional real logo |
| `stats` | embedded | precomputed rollup (see below) |
| `createdAt`/`updatedAt` | Date | |

`stocks.stats` is an **embedded rollup subdocument** (replaces the relational `StockStatsDaily` table) so the Stocks table and Dashboard read precomputed values with zero aggregation at request time:
```jsonc
stats: {
  mentions30d, distinctCreators,
  bullCount, neutralCount, bearCount, bullishPct,
  latestClose, dayChangePct, change30dPct,
  sparkline: [number],     // ~30-60 downsampled closes for list/pill rendering
  computedAt: Date
}
```
Recomputed after each ingestion run and on the nightly cron by the rollup job (§6.6).

**`pricePoints`** — daily close per stock. Stored as a native **time-series collection** (`timeField: date`, `metaField: meta`, `granularity: "hours"`).
| field | type | notes |
|---|---|---|
| `date` | Date | trading day (timeField) |
| `meta` | `{ stockId, ticker }` | metaField — Atlas groups buckets by this |
| `close` | number | |
| `source` | string | provider id, or `manual` for private marks |

Uniqueness `(stockId, date)` is enforced at the application layer via idempotent upserts keyed on meta+date (time-series collections don't support unique secondary indexes). Queries fetch trailing windows (22/66/132/260 trading days → 1M/3M/6M/1Y).

**`videos`** — one tracked YouTube video **with its mentions embedded**.
| field | type | notes |
|---|---|---|
| `_id` | ObjectId | |
| `creatorId` | ObjectId → creators | |
| `creator` | embedded `{ slug, name, handle, brandColor, initial, avatarUrl }` | denormalized for feed/modal rendering without a lookup |
| `youtubeVideoId` | string, unique index | dedup key |
| `title` | string | |
| `url` | string | real watch URL |
| `thumbnailUrl` | string? | real YT thumbnail; fallback to brand placeholder |
| `durationSeconds` | number? | |
| `publishedAt` | Date, indexed desc | drives "X ago", feed order, chart x-position |
| `transcriptStatus` | string enum | `PENDING \| CAPTIONS \| TRANSCRIBED \| FAILED \| SKIPPED` |
| `analysisStatus` | string enum | `PENDING \| ANALYZED \| FAILED \| NO_MENTIONS` |
| `summary` | string? | LLM-generated paragraph (modal body) |
| `language` | string | detected/declared |
| `mentions` | embedded `Mention[]` | the core calls (below) |
| `createdAt`/`updatedAt` | Date | |

Embedded **`Mention`** subdocument (one stock call inside the video):
| field | type | notes |
|---|---|---|
| `stockId` | ObjectId → stocks | |
| `ticker` | string | denormalized for chip/takeaway rendering |
| `sentiment` | string enum | `BULLISH \| NEUTRAL \| BEARISH` |
| `confidence` | number? | model confidence 0–1 |
| `note` | string | one-line takeaway ("Key takeaways" rows / tooltip) |
| `isPrimary` | boolean | headline ticker (largest on thumbnail) — exactly one true |
| `priceAtMention` | number? | close on/near `publishedAt`; "@ $X" labels & marker y-position |

Indexes on `videos`: `{ youtubeVideoId: 1 }` unique, `{ publishedAt: -1 }` (feed), `{ "mentions.stockId": 1, publishedAt: -1 }` multikey (Stock Detail coverage + marker queries), `{ creatorId: 1, publishedAt: -1 }` (creator recent calls). App-layer invariant: at most one mention per stock per video.

**`transcripts`** — separated from `videos` (large blob, read rarely; keeps the hot `videos` docs small).
| field | type | notes |
|---|---|---|
| `videoId` | ObjectId → videos, unique index | |
| `text` | string | full transcript |
| `segments` | `[{ start, end, text }]`? | for future timestamp linking |
| `source` | string enum | `YOUTUBE_CAPTIONS \| WHISPER` |

### 5.2 Relationships & consistency
- `creators 1—* videos` (ObjectId ref + denormalized `creator` snapshot).
- `videos —* mentions` **embedded**; each mention references `stocks` by ObjectId + denormalized `ticker`.
- `stocks 1—* pricePoints` (by `meta.stockId`).
- `videos 1—1 transcripts`.
- No DB-level foreign keys (Mongo). Integrity is kept by: idempotent upserts on natural keys, app-layer validation (Zod), and the rollup job reconciling denormalized snapshots. The analyze stage writes a video + its mentions in **one document write** (atomic per-document, no transaction needed); the rare cross-collection updates (e.g. backfilling `priceAtMention` after a price fill) use Atlas multi-document transactions where strict consistency matters, else eventually-consistent rollup.

### 5.3 Mapping to the prototype
The mock generator in `TickerTube.dc.html` (`creators{…}`, `cfg[]`, `videos[]` with `m:[[ticker,sentiment]]`) maps directly: `creators→creators`, `cfg→stocks` (+ generated `pricePoints` series), each `videos[]` entry → one `videos` doc with `m[]` → embedded `mentions[]` (`m[0]` → `isPrimary=true`). Sentiments `bull/neutral/bear` → `BULLISH/NEUTRAL/BEARISH`. This dataset doubles as the **seed** for local dev (`packages/db/seed.ts`).

---

## 6. Ingestion Pipeline

The pipeline is a chain of idempotent BullMQ stages. Each video flows through them independently; a failure in one stage retries that stage without redoing prior ones (state tracked on the `Video` row).

### 6.1 Queues & stages

| Queue | Job | Input → Output |
|---|---|---|
| `discover` | `discoverChannel` | creatorId → upserts new `Video` rows (status `PENDING`) for videos not seen before; enqueues `transcribe` for each. |
| `transcribe` | `transcribeVideo` | videoId → tries YouTube captions; on miss, downloads audio + Whisper; writes `Transcript`; sets `transcriptStatus`; enqueues `analyze`. |
| `analyze` | `analyzeVideo` | videoId → Claude tool-use extraction → `Mention[]` + `summary`; sets `analysisStatus`; enqueues `priceFill` for affected stocks. |
| `prices` | `fillPrices` | stockId → fetches/updates daily `PricePoint`s; backfills `priceAtMention` for new mentions. |
| `rollup` | `rebuildStats` | (none) → recomputes the embedded `stocks.stats` rollup for each stock. |

Job options: `attempts: 4`, exponential backoff (`5s → 4m`), `removeOnComplete: {age: 24h}`, per-queue concurrency tuned to provider rate limits (e.g. `analyze` concurrency 3, `transcribe` 2). BullMQ `jobId` = a natural key (`discover:<creatorId>:<runId>`, `transcribe:<videoId>`, etc.) so duplicate enqueues dedup.

### 6.2 Discovery
For each active creator, call YouTube Data API `search.list`/`playlistItems` (uploads playlist) for videos published since `max(publishedAt)` we have. Upsert by `youtubeVideoId`. New videos → `transcribe` queue. (Optionally subscribe to **PubSubHubbub** push for near-instant discovery; cron polling is the v1 baseline.)

### 6.3 Transcription
1. Fetch YouTube caption track (auto or manual) → `source = YOUTUBE_CAPTIONS`.
2. If absent: download audio (yt-dlp), send to Whisper provider → `source = WHISPER`.
3. Long videos chunked; segments stored for future timestamp anchoring.
4. Non-English creators (`language=zh`) keep the original-language transcript; the extraction prompt is language-aware.

### 6.4 Analysis (LLM extraction)
A single Claude **tool-use** call per video. The tool schema forces structured output:

```jsonc
// tool: record_analysis
{
  "summary": "string — 2-4 sentence neutral recap",
  "mentions": [{
    "ticker": "string — must resolve to a tracked Stock; unknowns dropped",
    "sentiment": "BULLISH | NEUTRAL | BEARISH",
    "confidence": 0.0,             // 0-1
    "isPrimary": false,            // exactly one true = headline call
    "note": "string — one-line takeaway in plain English"
  }]
}
```

- System prompt pins the role ("extract explicit stock calls a finance creator makes; do not infer calls that aren't stated; sentiment is the creator's stance, not the market's").
- Input = title + transcript (truncated/chunked with map-reduce for very long videos).
- Ticker resolution: map model output against the `Stock` table (alias list, e.g. "Nvidia/英伟达" → `NVDA`). Unknown tickers are logged for an admin to optionally add as new `Stock`s — not auto-created.
- Output validated with Zod; on schema failure or low aggregate confidence, **retry once on `claude-opus-4-8`**, then mark `analysisStatus=FAILED` for manual review.
- Zero valid mentions → `NO_MENTIONS` (still keep `summary`, no `Mention` rows).

Cost control: Haiku-first, prompt caching of the system prompt + tool schema, and skipping re-analysis of unchanged transcripts.

### 6.5 Price fill
- For each `Stock` with new/changed mentions, ensure daily `PricePoint`s cover the chart windows.
- **Public tickers**: provider `historical-price` (daily). Incremental — fetch only the gap since the latest stored `date`.
- **Private tickers** (`isPrivate`, e.g. SPACEX): no public feed. Marks come from a `manual`/secondary-market source ingested via an admin CSV/endpoint; the pipeline interpolates between known marks for chart continuity and flags them `source=manual`.
- After fill, set each new mention's `priceAtMention` = close on (or nearest trading day before) `publishedAt`.

### 6.6 Rollup
`rebuildStats` recomputes each stock's embedded `stats` subdocument (30-day mention counts via a `$match`/`$unwind`/`$group` aggregation over `videos.mentions`, sentiment split, bullish %, latest price, day & 30-day change, downsampled sparkline). Runs after every ingestion pass and on the nightly cron so the Dashboard/Stocks pages read precomputed values with no aggregation at request time.

---

## 7. Scheduling on Railway

Railway runs a **cron service** (the `scheduler` app) — a container that Railway starts on a cron expression, runs to completion, and stops. It does **not** do work itself; it only **enqueues** BullMQ jobs, so scheduling stays decoupled from execution (the long-running `worker` service owns retries, backoff, and concurrency).

`railway.json` (excerpt):
```jsonc
{
  "services": {
    "scheduler": {
      "build": { "buildCommand": "pnpm --filter scheduler build" },
      "deploy": {
        "startCommand": "node apps/scheduler/dist/index.js",
        "cronSchedule": "*/30 * * * *"   // every 30 min: discover + transcribe + analyze sweep
      }
    }
  }
}
```

Scheduling plan:
| Cadence | Action |
|---|---|
| Every 30 min | `discover` for all active creators (new uploads → transcribe → analyze cascade). |
| Hourly | `prices` incremental fill for all stocks (intra-day not needed; keeps "today" fresh). |
| Nightly 04:00 UTC | Full `prices` reconcile + `rebuildStats` rollup + retry sweep of `FAILED` videos. |

Because Railway cron starts a fresh container per tick, the scheduler is stateless: it connects to Redis, enqueues the due jobs (using deterministic `jobId`s so overlapping ticks dedup), and exits. If finer-grained or in-process scheduling is ever needed, `node-cron` inside the always-on `worker` is the fallback — but the cron-service approach is preferred because a hung tick can't wedge the worker, and schedules live in config, not code.

**Idempotency & overlap safety**: every stage is safe to run twice (natural `jobId`s, upserts keyed on `youtubeVideoId`/`(stockId,date)`/`(videoId,stockId)`). A slow run overlapping the next tick cannot double-insert.

---

## 8. API Design

Fastify, JSON, read-only public endpoints (no auth in v1). All responses are typed DTOs from `packages/shared` and validated/serialized via Fastify schemas. TanStack Query on the client caches per endpoint.

### 8.1 Public read endpoints

| Method · Path | Purpose | Powers |
|---|---|---|
| `GET /api/dashboard` | Highlight pills (NVDA/GOOGL/COIN/SPACEX), "Latest analysis" feed, "Most mentioned" + "Most bullish" leaderboards. | Dashboard |
| `GET /api/stocks?sort=&limit=` | Stock rows with sparkline points, 30d change, sentiment split, mention & creator counts. `sort ∈ mentions\|bull\|chg\|price\|ticker`. | Stocks table |
| `GET /api/stocks/:ticker?tf=` | Stock detail: metadata, price series for timeframe (`tf ∈ 1M\|3M\|6M\|1Y`), overall sentiment summary, recent coverage events. | Stock Detail |
| `GET /api/stocks/:ticker/markers?tf=` | Chart markers: per video in window `{creator, date, x-anchor=date, y-anchor=priceAtMention, sentiment, title, priceLabel}`. | Chart avatars/tooltips |
| `GET /api/creators` | Creator cards: bio, subs, videos tracked, bullish %, covered tickers, up to 3 recent calls. | Creators |
| `GET /api/videos/:id` | Full video summary: creator, title, summary, key takeaways (per-mention note + sentiment + ticker link), watch URL. | Summary modal |
| `GET /api/search?q=` | Typeahead over tickers + creators. | Nav search |
| `GET /healthz` | Liveness for Railway. | infra |

### 8.2 Admin endpoints (protected by a static admin token / Railway private networking)
| `POST /api/admin/creators` | Add/activate a tracked channel. |
| `POST /api/admin/stocks` | Add a tracked ticker (incl. private + brand colors). |
| `POST /api/admin/stocks/:ticker/prices` | Upload manual/secondary marks (private names) via CSV/JSON. |
| `POST /api/admin/videos/:id/reanalyze` | Force re-run of `analyze` (e.g. after prompt change). |
| `POST /api/admin/ingest/run` | Manually trigger a discovery sweep. |

### 8.3 Response shaping
- The server reads display-ready aggregates (bullish %, verdict word "Strong buy/Buy/Mixed/Cautious", sentiment splits, sparkline point arrays) from the precomputed `stocks.stats` subdocument, and pulls windowed series from `pricePoints`, so the client stays presentational. Number/date **formatting** (e.g. "612K", "@ $118.20") happens client-side per the design tokens.
- Sparkline points are downsampled server-side to ~30–60 points; the detail chart returns full daily resolution for the requested window.
- Caching: `Cache-Control: public, max-age=60` on read endpoints + an in-process/Redis cache for the dashboard and stock-list payloads (invalidated on rollup).

---

## 9. Frontend Architecture

SPA in `apps/web`, recreating the five screens in `design/README.md` pixel-accurately.

### 9.1 Routing → design state machine
| Route | Screen | Notes |
|---|---|---|
| `/` | Dashboard | |
| `/stocks` | Stocks browse | `?sort=` mirrors `stkSort`. |
| `/stocks/:ticker` | Stock detail | `?tf=` mirrors timeframe (22/66/132/260 trading days). |
| `/creators` | Creators directory | |
| `?video=:id` (search param, any route) | Summary modal | Modal is overlay state (`openVid`), deep-linkable. |

### 9.2 Component map
- `Nav` (sticky blurred bar, search field) · `StockPill` · `VideoCard` (+ `StockChip`, `SentimentIcon`) · `Leaderboard{Mentioned,Bullish}` · `StockTable`/`StockRow` · `SentimentBar` (stacked bull/neutral/bear) · `Sparkline` · `PriceChart` (SVG area+line + `CreatorMarker` overlay + `MarkerTooltip`) · `CreatorCard` · `VideoSummaryModal`.
- `StockChip` navigates to `/stocks/:ticker` and `stopPropagation()`s inside clickable parents (per design §Interactions).
- External links (thumbnails, titles, "Visit", "Watch full video") → `target="_blank" rel="noopener"` to real YT URLs from the API.

### 9.3 Chart implementation
The annotated chart is bespoke: a responsive `<svg viewBox="0 0 1000 360" preserveAspectRatio="none">` with a vertical-gradient area fill (brand color 0.16→0), a `non-scaling-stroke` line, 5 gridlines + price labels, and 6 x-axis date ticks. Creator markers are an **absolutely-positioned HTML overlay** (not inside the SVG) so avatars stay circular under `preserveAspectRatio="none"`: each marker's `left/top` is computed from `visx` `scaleTime`/`scaleLinear` against the same domain as the path. Markers reposition on `tf` change; tooltips show on hover with the design's transition.

### 9.4 Design tokens
Tokens from `design/README.md §Design Tokens` (colors, sentiment palette, per-stock & per-creator brand colors, Space Grotesk / Plus Jakarta Sans / JetBrains Mono, radii, shadows, 1240px container) are encoded in `tailwind.config.ts` `theme.extend` + CSS variables. Fonts via Google Fonts. App icon from `design/assets/stonktube-icon*.svg`, exported to PNG (16/32/48/180/192/512) for favicon + PWA.

### 9.5 Data & state
- Server data via **TanStack Query** (one query per endpoint; `staleTime` ~60s matching API cache).
- Local UI state (active timeframe, sort pill, open modal) in URL params + small local state — no global store needed.

### 9.6 Serving
In production the `api` service serves the built SPA (`apps/web/dist`) as static assets with SPA fallback, so one public domain hosts both UI and `/api/*`. (Alternatively the SPA could be a separate Railway static site; co-serving keeps deploys atomic and avoids CORS.)

---

## 10. Configuration & Secrets

Per-service env vars (Railway variables; the Redis URL is injected by the Railway plugin via a reference variable, the Mongo URI comes from Atlas):

| Var | Used by | Notes |
|---|---|---|
| `MONGODB_URI` | api, worker, scheduler | Atlas SRV connection string (TLS). Set Atlas Network Access to allow Railway egress (allowlist `0.0.0.0/0` with a strong DB user, or Atlas PrivateLink). |
| `REDIS_URL` | api, worker, scheduler | Railway Redis reference. |
| `ANTHROPIC_API_KEY` | worker | Claude extraction. |
| `YOUTUBE_API_KEY` | worker, scheduler | Data API quota-bearing key. |
| `TRANSCRIPTION_PROVIDER` / `…_API_KEY` | worker | Whisper/Deepgram fallback. |
| `MARKET_DATA_PROVIDER` / `…_API_KEY` | worker | FMP/Polygon. |
| `ADMIN_TOKEN` | api | Guards `/api/admin/*`. |
| `PORT` | api | Railway-provided. |
| `NODE_ENV`, `LOG_LEVEL` | all | |

---

## 11. Deployment (Railway)

- **One project**, services `web` (api+SPA), `worker`, `scheduler`, plus a Railway Redis plugin; **MongoDB Atlas** is external (connected via `MONGODB_URI`). Inter-service traffic over Railway **private networking**; only `web` exposes a public domain.
- **Build**: pnpm + Turborepo. Each service has a build/start command targeting its app (`pnpm --filter <app> build` → `node apps/<app>/dist/index.js`). A Dockerfile per service (or Railway Nixpacks) — Dockerfile preferred for the `worker` since it needs `yt-dlp`/ffmpeg for the Whisper fallback.
- **Schema/indexes**: Mongo is schemaless, so there are no migrations to run. A small `ensureIndexes`/bootstrap step (creating unique indexes + the `pricePoints` time-series collection if absent) runs as a release/predeploy step on the `web` service before it starts; data-shape changes are handled with versioned backfill jobs in `packages/db` rather than DDL migrations.
- **Scaling**: `web` scales horizontally (stateless behind Railway's load balancer). `worker` scales by replica count / BullMQ concurrency. `scheduler` is a single cron service (must not be replicated — overlap is handled by dedup `jobId`s but one instance is simplest).
- **Health**: `GET /healthz` for `web`; worker liveness via BullMQ heartbeat + a `/healthz` on an internal port.
- **Rollback**: Railway keeps prior deploys; DB migrations are forward-only with care (additive columns, backfills as jobs).

---

## 12. Observability & Ops

- **Logging**: structured JSON (`pino`) to Railway logs; per-job correlation id (`videoId`/`runId`).
- **Metrics**: BullMQ queue depths, job durations, failure counts; LLM token spend per run; price-provider error rate. Exposed via a `/metrics` endpoint or pushed to a provider.
- **Alerting**: a job that flags `analysisStatus=FAILED` / `transcriptStatus=FAILED` backlogs; alert if discovery hasn't run in >2h.
- **Admin via CLI/scripts** in `packages/db` and admin endpoints (no admin UI in v1).
- **Dead-letter**: jobs exhausting `attempts` land in a failed set; the nightly retry sweep re-enqueues recoverable ones, leaves the rest for manual review.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YouTube Data API quota limits | Use uploads-playlist polling (cheap) over `search.list`; cache channel metadata; spread discovery; PubSubHubbub push to cut polling. |
| Videos without captions / non-English | Whisper fallback; language-aware extraction prompt; per-creator `language`. |
| LLM hallucinating tickers/sentiment | Strict tool-use schema + Zod validation; resolve tickers against the `Stock` table; drop unknowns; Opus escalation + manual-review state; system prompt forbids inferring unstated calls. |
| LLM cost at scale | Haiku-first, prompt caching, skip unchanged transcripts, batch. |
| Private names (SPACEX) have no price feed | Manual/secondary-market marks via admin upload, interpolated, flagged `source=manual`. |
| Market-data provider lock-in / outages | Provider behind an interface; daily resolution tolerates retries/gaps; nightly reconcile. |
| Cron overlap / double processing | Idempotent stages, deterministic `jobId`s, upsert keys, single scheduler instance. |
| Legal/accuracy (financial content) | Site is informational, attributes every call to its source video + timestamp; disclaimer in footer; no advice/trading. |

---

## 14. Build Phases

1. **Foundation** — monorepo, Mongoose models + index bootstrap, seed from the prototype dataset, MongoDB Atlas cluster + Railway project with Redis.
2. **Read API + Frontend** — implement all `GET /api/*` against seeded data; build the five screens pixel-accurate to the design (this is fully demoable on seed data alone).
3. **Pipeline** — discover → transcribe → analyze → prices → rollup queues + workers; wire Claude tool-use extraction; market-data provider.
4. **Scheduling & Ops** — Railway cron service, schedules, retries, observability, admin endpoints.
5. **Hardening** — caching, private-name handling, alerting, cost tuning, PWA/icons.
```
