/**
 * Re-run Gemini analysis for a single creator's already-analyzed videos.
 * Enqueues with force:true so videos stay ANALYZED/visible throughout.
 *
 *   CREATOR_SLUG=meitou-news node apps/worker/dist/reanalyze-creator.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video, Transcript } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

const CREATOR_SLUG = process.env.CREATOR_SLUG
if (!CREATOR_SLUG) {
  log.error('CREATOR_SLUG env var is required')
  process.exit(1)
}

await connectDB()

const creator = await Creator.findOne({ slug: CREATOR_SLUG, isActive: true }).lean()
if (!creator) {
  log.error({ CREATOR_SLUG }, 'Creator not found')
  process.exit(1)
}

const transcriptVideoIds = await Transcript.distinct('videoId', {})
const videos = await Video.find({
  creatorId: creator._id,
  _id: { $in: transcriptVideoIds },
  analysisStatus: 'ANALYZED',
}).select('_id title').lean()

log.info({ name: creator.name, count: videos.length }, 'Re-queuing for re-analysis')

const spacingMs = Number(process.env.REANALYZE_SPACING_MS ?? 15_000)

let i = 0
for (const v of videos) {
  const jobId = `reanalyze-${v._id}-${Date.now()}`
  await analyzeQueue.add(
    'analyze',
    { videoId: v._id.toString(), force: true },
    { jobId, delay: i * spacingMs },
  )
  log.info({ title: v.title?.slice(0, 60) }, 'Enqueued')
  i++
}

const mins = Math.ceil((videos.length * spacingMs) / 60_000)
log.info({ enqueued: videos.length, spacingMs, estimatedMins: mins }, 'Done. Then run recompute-stats.')

await analyzeQueue.close()
await disconnectDB()
