import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

// Required: set CREATOR_SLUG to target a specific creator.
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

// Find all videos that were SKIPPED during transcription.
// SKIPPED = transcript failed (e.g. Gemini quota exhausted); reset to PENDING and re-queue.
const skipped = await Video.find({
  creatorId: creator._id,
  transcriptStatus: 'SKIPPED',
}).lean()

log.info({ name: creator.name, count: skipped.length }, 'Resetting SKIPPED → PENDING and re-queuing transcribe jobs')

let queued = 0
for (const v of skipped) {
  await Video.updateOne({ _id: v._id }, { $set: { transcriptStatus: 'PENDING' } })
  await transcribeQueue.add(
    'transcribe',
    { videoId: v._id.toString() },
    {
      jobId: `transcribe-${v._id}-retry`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  )
  log.info({ title: v.title?.slice(0, 70), publishedAt: v.publishedAt?.toISOString().slice(0, 10) }, 'Re-queued')
  queued++
}

log.info({ queued }, 'Done — transcribe jobs enqueued')

await transcribeQueue.close()
await disconnectDB()
