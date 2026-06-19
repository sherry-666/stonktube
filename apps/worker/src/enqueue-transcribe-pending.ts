import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'

// One-off: re-enqueue transcribe for videos that never got a transcript
// (e.g. older yt-dlp failures). The transcribe handler now uses Gemini's
// native YouTube ingestion, so these can be reprocessed.
await connectDB()

const videos = await Video.find({ transcriptStatus: { $in: ['PENDING', 'SKIPPED', 'FAILED'] } })
console.log(`Re-enqueuing transcribe for ${videos.length} videos`)

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
