/**
 * Backfill durationSeconds on existing videos from the YouTube API, then DELETE
 * any that are shorter than MIN_VIDEO_SECONDS (Shorts / trivial clips) along
 * with their embedded mentions. Run once after adding the duration gate.
 *
 * After it finishes, refresh stats:
 *   node packages/db/dist/recompute-stats.js
 *
 *   pnpm --filter @stonktube/worker backfill-durations
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'
import { MIN_VIDEO_SECONDS, isTooShort, parseIso8601Duration } from '@stonktube/shared'

const YT_API = 'https://www.googleapis.com/youtube/v3'

async function fetchDurations(videoIds: string[]): Promise<Map<string, number>> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  const durations = new Map<string, number>()
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await fetch(`${YT_API}/videos?part=contentDetails&id=${batch.join(',')}&key=${key}`)
    if (!res.ok) throw new Error(`YouTube API ${res.status}`)
    const data = (await res.json()) as { items: { id: string; contentDetails: { duration: string } }[] }
    for (const item of data.items ?? []) {
      durations.set(item.id, parseIso8601Duration(item.contentDetails.duration))
    }
  }
  return durations
}

await connectDB()

const videos = await Video.find({}).select('_id youtubeVideoId title').lean()
console.log(`Videos: ${videos.length} | min seconds: ${MIN_VIDEO_SECONDS}`)

const durations = await fetchDurations(videos.map(v => v.youtubeVideoId))
console.log(`Fetched durations for ${durations.size} videos`)

const shortIds: typeof videos[number]['_id'][] = []
let updated = 0
let missing = 0

for (const v of videos) {
  const secs = durations.get(v.youtubeVideoId)
  if (secs == null) {
    // Deleted/private on YouTube — leave as-is (duration unknown).
    missing++
    continue
  }
  await Video.updateOne({ _id: v._id }, { $set: { durationSeconds: secs } })
  updated++
  if (isTooShort(secs)) {
    shortIds.push(v._id)
    console.log(`  short (${secs}s): ${v.title?.slice(0, 60)}`)
  }
}

const del = await Video.deleteMany({ _id: { $in: shortIds } })
console.log(`\nUpdated durations: ${updated} | unknown (not on YouTube): ${missing}`)
console.log(`Deleted ${del.deletedCount} sub-${MIN_VIDEO_SECONDS}s videos. Now run recompute-stats.`)

await disconnectDB()
