/**
 * Re-run Gemini analysis on already-analyzed videos so they pick up the latest
 * extraction logic (e.g. the OPINION/FACTUAL stance gate). Resets their
 * analysisStatus to PENDING — otherwise handleAnalyze early-returns on ANALYZED —
 * and enqueues an analyze job for each.
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

for (const v of videos) {
  await v.updateOne({ analysisStatus: 'PENDING' })
  const jobId = `analyze-${v._id}-${Date.now()}`
  await analyzeQueue.add('analyze', { videoId: v._id.toString() }, { jobId })
  console.log(' -', v.title?.slice(0, 60))
}

console.log('Enqueued. Let the worker drain, then run recompute-stats.')

await analyzeQueue.close()
await disconnectDB()
