import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

const CREATOR_SLUG = process.env.CREATOR_SLUG
if (!CREATOR_SLUG) throw new Error('CREATOR_SLUG is required')

await connectDB()

const creator = await Creator.findOne({ slug: CREATOR_SLUG }).lean()
if (!creator) throw new Error(`Creator not found: ${CREATOR_SLUG}`)

const pending = await Video.find({ creatorId: creator._id, transcriptStatus: 'PENDING' }).lean()
log.info({ name: creator.name, count: pending.length }, 'Enqueuing PENDING videos')

let queued = 0
for (const v of pending) {
  await transcribeQueue.add(
    'transcribe',
    { videoId: v._id.toString() },
    { jobId: `transcribe-${v._id}-backfill`, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  )
  queued++
}

log.info({ queued }, 'Done')
await transcribeQueue.close()
await disconnectDB()
