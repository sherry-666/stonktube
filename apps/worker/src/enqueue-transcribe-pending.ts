import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'

// Enqueue pending/failed videos for transcription.
// CREATOR_SLUG — limit to one creator (e.g. "bella"). Omit to target all.
// LIMIT        — max videos to enqueue in this run (e.g. "100"). Omit for all matching.
const CREATOR_SLUG = process.env.CREATOR_SLUG
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined

await connectDB()

const filter: Record<string, unknown> = { transcriptStatus: { $in: ['PENDING', 'SKIPPED', 'FAILED'] } }
if (CREATOR_SLUG) filter['creator.slug'] = CREATOR_SLUG

const query = Video.find(filter).sort({ publishedAt: -1 })
if (LIMIT) query.limit(LIMIT)
const videos = await query

console.log(`Enqueuing ${videos.length} videos${CREATOR_SLUG ? ` for ${CREATOR_SLUG}` : ''}${LIMIT ? ` (limit ${LIMIT})` : ''}`)

for (const v of videos) {
  await transcribeQueue.add(
    'transcribe',
    { videoId: v._id.toString() },
    { jobId: `transcribe-${v._id}-retry-${Date.now()}`, attempts: 2, backoff: { type: 'exponential', delay: 30_000 } },
  )
  console.log(' -', v.title?.slice(0, 60))
}

await transcribeQueue.close()
await disconnectDB()
console.log('Done.')
