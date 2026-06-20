/**
 * Re-run Gemini analysis on already-analyzed videos so they pick up the latest
 * extraction logic (e.g. the OPINION/FACTUAL stance gate).
 *
 * Enqueues each job with `force: true`, which re-analyzes in place WITHOUT
 * changing analysisStatus — so videos stay ANALYZED (and visible) throughout the
 * backfill, and a failed re-run preserves the existing analysis instead of
 * degrading it. The worker's rate limiter (≤10/min) keeps Gemini under quota, so
 * a large backfill simply drips through over several minutes.
 *
 * Requires the worker to be running to drain the queue. After it finishes,
 * recompute stats:  node packages/db/dist/recompute-stats.js
 *
 *   pnpm --filter @stonktube/worker reanalyze
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video, Transcript } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'

await connectDB()

// Only re-analyze videos that still have a transcript to work from.
const transcriptVideoIds = await Transcript.distinct('videoId')
const videos = await Video.find({
  _id: { $in: transcriptVideoIds },
  analysisStatus: 'ANALYZED',
}).select('_id title')

console.log('Videos to re-analyze:', videos.length)

// Gemini's limit is tokens/min (1M TPM). Spacing jobs ~15s apart (≈4/min) keeps
// even large transcripts well under that. Combined with worker concurrency 1,
// token usage never bursts. Tunable via REANALYZE_SPACING_MS.
const spacingMs = Number(process.env.REANALYZE_SPACING_MS ?? 15_000)

let i = 0
for (const v of videos) {
  const jobId = `reanalyze-${v._id}-${Date.now()}`
  await analyzeQueue.add(
    'analyze',
    { videoId: v._id.toString(), force: true },
    { jobId, delay: i * spacingMs },
  )
  console.log(' -', v.title?.slice(0, 60))
  i++
}

const mins = Math.ceil((videos.length * spacingMs) / 60_000)
console.log(`Enqueued ${videos.length} (force, ${spacingMs}ms apart ≈ ${mins} min). Then run recompute-stats.`)

await analyzeQueue.close()
await disconnectDB()
