# StonkTube — Agent Instructions

## Data integrity (hard rule)

**Never insert fake, dummy, synthetic, or placeholder data into MongoDB** (any environment, especially production Atlas).

This includes, but is not limited to:
- Seed/demo videos (e.g. `youtubeVideoId` values like `seed_*`, hand-written titles, fabricated mentions)
- Synthetic/random-walk price points (anything not sourced from a real provider such as Yahoo Finance)
- Hardcoded sentiment, mention, or rollup data not produced by the real pipeline

Only data produced by the real pipeline is allowed in the DB:
- **Videos**: discovered via the YouTube Data API (real `youtubeVideoId`s)
- **Transcripts**: from YouTube captions or Gemini transcription
- **Mentions/sentiment**: from Gemini analysis of real transcripts
- **Prices**: real market data from Yahoo Finance (`yahoo-finance2`), `source: 'yahoo'`

The seed scripts (`packages/db/src/seed.ts`) and `update-channels.ts` exist for local prototyping only. `seed.ts` inserts fake videos and synthetic prices — **do not run it against production**. If creators/stocks reference data is needed in prod, insert only the real creator/stock metadata (real channel IDs, real tickers) without the fabricated videos or price history.
