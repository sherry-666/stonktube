# StonkTube — Build Task Sequence

Ordered, checkable tasks to take StonkTube from empty repo to a deployed, self-running app on Railway. Phases are sequential; tasks within a phase are mostly parallelizable unless a dependency is noted. References point to sections of `tdd.md`.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · 🔗 depends on · ⭐ milestone

---

## Phase 0 — Project setup & infrastructure
Goal: empty repo → working monorepo with datastores reachable locally.

- [ ] Initialize **pnpm + Turborepo monorepo** with the layout in `tdd.md §4` (`apps/{web,api,worker,scheduler}`, `packages/{shared,db,pipeline}`).
- [ ] Add shared tooling: TypeScript base config, ESLint + Prettier, `tsconfig` project references, `.env.example`.
- [ ] Create **MongoDB Atlas** cluster (M0 free tier ok to start); create DB user; capture `MONGODB_URI`.
- [ ] Stand up **local dev datastores**: Mongo via `docker-compose` (or Atlas dev cluster) + Redis via `docker-compose`.
- [ ] Create the **Railway project**; add the Redis plugin; create the three service shells (`web`, `worker`, `scheduler`) — no deploys yet. (§11)
- [ ] Wire Railway ↔ Atlas network access (allowlist Railway egress or PrivateLink). (§10)
- [ ] ⭐ `pnpm install && pnpm build` passes; each app has a no-op start script.

---

## Phase 1 — Data layer & shared types
Goal: the data model exists, is typed, and is seeded from the prototype dataset. 🔗 Phase 0

- [ ] In `packages/shared`: define **Zod schemas + TS types** for `Sentiment` enum, all DTOs, and queue job payloads. (§5, §8)
- [ ] In `packages/db`: **Mongoose connection** helper + models for `creators`, `stocks`, `videos` (with embedded `mentions` + denormalized `creator`), `transcripts`. (§5.1)
- [ ] Create the **`pricePoints` time-series collection** + the `ensureIndexes` bootstrap (unique indexes, multikey `mentions.stockId`, feed/creator indexes). (§5.1, §11)
- [ ] Write the **`stocks.stats` rollup** type and an `embeddedStats` computation helper (used by Phase 3 rollup too). (§5.1, §6.6)
- [ ] Build **`seed.ts`**: port `creators{…}`, `cfg[]`, `videos[]` and the generated price series from `design/TickerTube.dc.html` into the collections (`m[0]` → `isPrimary`, `bull/neutral/bear` → enum). (§5.3)
- [ ] ⭐ Seeded local DB queryable; a smoke script prints dashboard-shaped data.

---

## Phase 2 — Read API & frontend (demoable on seed data)
Goal: the full design runs end-to-end against seeded data — no live pipeline yet. 🔗 Phase 1

### Backend — read API (`apps/api`)
- [ ] Fastify app skeleton: config loading, Mongoose connect, `pino` logging, `GET /healthz`. (§8, §12)
- [ ] Implement read endpoints with Fastify schemas: `/api/dashboard`, `/api/stocks`, `/api/stocks/:ticker`, `/api/stocks/:ticker/markers`, `/api/creators`, `/api/videos/:id`, `/api/search`. (§8.1)
- [ ] Server-side shaping: read aggregates from `stocks.stats`, window `pricePoints`, downsample sparklines, compute verdict words. (§8.3)
- [ ] Response caching (`Cache-Control` + Redis cache for dashboard/list, invalidated on rollup). (§8.3)

### Frontend (`apps/web`)
- [ ] Vite + React + TS scaffold; **Tailwind theme** encoding all design tokens (colors, sentiment palette, brand colors, fonts, radii, shadows, 1240px container). (§9.4, `design/README.md §Design Tokens`)
- [ ] App shell + **routing** (`/`, `/stocks`, `/stocks/:ticker`, `/creators`, `?video=` modal) + TanStack Query setup. (§9.1, §9.5)
- [ ] **Nav** bar (sticky, blur, search field). (`design/README.md §1`)
- [ ] **Dashboard**: stock pills, "Latest analysis" feed, "Most mentioned" + "Most bullish" leaderboards. (§2)
- [ ] Shared components: `VideoCard`, `StockChip`, `SentimentIcon`/`SentimentBar`, `Sparkline`. (§Component specs)
- [ ] **Stocks** browse: sortable table with all 6 columns + sort pills. (§3)
- [ ] **Stock Detail**: header, the bespoke **SVG price chart** (gradient area + non-scaling line + gridlines) with the **absolutely-positioned creator-avatar marker overlay** + hover tooltips, timeframe control, recent coverage, overall-sentiment card. (§9.3, design §4)
- [ ] **Creators** directory cards. (§5 design)
- [ ] **Video Summary Modal** (deep-linkable via `?video=`). (§Component)
- [ ] Wire external links (`target="_blank" rel="noopener"`), chip `stopPropagation`, hover states/transitions.
- [ ] Export app icon to PNG sizes (16/32/48/180/192/512) + favicon/PWA manifest. (§9.4, `design/assets`)
- [ ] ⭐ Pixel-check every screen against `design/README.md`; full app demoable on seed data.

---

## Phase 3 — Ingestion pipeline
Goal: real videos flow in and become scored mentions + prices. 🔗 Phase 1 (can overlap Phase 2)

- [ ] **BullMQ setup** in `packages/pipeline`: queue definitions, worker bootstrap, shared job options (attempts/backoff, dedup `jobId`s, per-queue concurrency). (§6.1)
- [ ] **Discovery** (`discoverChannel`): YouTube Data API uploads-playlist polling since `max(publishedAt)`; upsert `videos` by `youtubeVideoId`; enqueue transcribe. (§6.2)
- [ ] **Transcription** (`transcribeVideo`): captions via `youtube-transcript-api`/`yt-dlp` → Whisper fallback (audio pull + multilingual STT); write `transcripts`; set status. (§6.3)
- [ ] **Analysis** (`analyzeVideo`): Claude **tool-use** extraction (Haiku → Opus escalation), strict schema + Zod validation, ticker resolution against `stocks.aliases`, write embedded `mentions` + `summary`. (§6.4)
- [ ] Implement **prompt-caching** of system prompt + tool schema; skip re-analysis of unchanged transcripts. (§6.4)
- [ ] **Market-data provider interface** + FMP (default) and one alt (Twelve Data) implementations. (§3, §6.5)
- [ ] **Price fill** (`fillPrices`): incremental daily close into `pricePoints`; backfill `priceAtMention`; manual-mark path for private tickers. (§6.5)
- [ ] **Rollup** (`rebuildStats`): recompute `stocks.stats` via aggregation over `videos.mentions` + latest prices. (§6.6)
- [ ] ⭐ End-to-end pipeline run on a single real channel produces correct dashboard data.

---

## Phase 4 — Scheduling, admin & ops
Goal: the app runs itself and is operable. 🔗 Phase 3

- [ ] **Scheduler service** (`apps/scheduler`): connects to Redis, enqueues due jobs with deterministic `jobId`s, exits. (§7)
- [ ] Configure Railway **cron schedules**: 30-min discovery sweep, hourly price fill, nightly reconcile + rollup + failed-retry sweep. (§7)
- [ ] **Admin endpoints** guarded by `ADMIN_TOKEN`: add creator, add stock, upload private-name price marks (CSV/JSON), re-analyze video, manual ingest trigger. (§8.2)
- [ ] **Observability**: structured logs with correlation ids, queue-depth/duration/failure metrics, LLM token-spend tracking, `/metrics`. (§12)
- [ ] **Alerting** + dead-letter handling: FAILED-backlog alarm, "no discovery in >2h" alarm, nightly retry sweep. (§12)
- [ ] ⭐ Pipeline runs unattended for 24h with no manual intervention.

---

## Phase 5 — Deploy & hardening
Goal: production on Railway, cost-tuned and robust. 🔗 Phase 2 + Phase 4

- [ ] **Dockerfiles** per service (worker image includes `yt-dlp` + `ffmpeg`); Railway build/start commands. (§11)
- [ ] `api` service **co-serves the built SPA** (static + SPA fallback); one public domain. (§9.6)
- [ ] **Index bootstrap** as predeploy/release step on `web`. (§11)
- [ ] Set all **env vars / secrets** per service in Railway. (§10)
- [ ] First **production deploy**; verify all screens + a live pipeline run against prod Atlas.
- [ ] **Cost tuning**: confirm Haiku-first + prompt caching, tune concurrency vs provider rate limits, validate free-tier price-API usage.
- [ ] **Hardening**: SPACEX/private-name marks loaded, caching validated, error budgets, footer disclaimer (informational, sources attributed). (§13)
- [ ] ⭐ **v1 live** — public, self-updating StonkTube.

---

## Suggested critical path
`Phase 0 → Phase 1 → Phase 2 (demo on seed)` in parallel with `Phase 3` once Phase 1 lands → `Phase 4` → `Phase 5`.
The fastest route to a **visible, shippable demo** is Phase 0→1→2 on seed data; the pipeline (3) and automation (4) can then light it up with real data without touching the frontend.
