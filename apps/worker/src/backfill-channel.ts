import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'
import { isTooShort, parseIso8601Duration, MIN_VIDEO_SECONDS } from '@stonktube/shared'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const YT_API = 'https://www.googleapis.com/youtube/v3'
const SINCE = new Date(process.env.SINCE_DATE ?? '2026-04-01T00:00:00.000Z')
const SKIP_ENQUEUE = process.env.SKIP_ENQUEUE === 'true'

// Required: set CREATOR_SLUG env var to target a specific creator (e.g. "meitounews").
// Leave unset to backfill all active creators.
const CREATOR_SLUG = process.env.CREATOR_SLUG

async function ytGet<T>(path: string): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${YT_API}${path}${sep}key=${key}`)
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function getUploadsPlaylistId(channelId: string): Promise<string> {
  const data = await ytGet<{ items: { contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    `/channels?part=contentDetails&id=${channelId}`,
  )
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) throw new Error(`No uploads playlist for channel ${channelId}`)
  return uploads
}

async function fetchDurations(videoIds: string[]): Promise<Map<string, number>> {
  const durations = new Map<string, number>()
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const data = await ytGet<{ items: { id: string; contentDetails: { duration: string } }[] }>(
      `/videos?part=contentDetails&id=${batch.join(',')}`,
    )
    for (const item of data.items ?? []) {
      durations.set(item.id, parseIso8601Duration(item.contentDetails.duration))
    }
  }
  return durations
}

interface PlaylistItem {
  snippet: {
    title: string
    publishedAt: string
    thumbnails?: { medium?: { url: string } }
    resourceId: { videoId: string }
  }
}

async function fetchVideosSince(playlistId: string, since: Date): Promise<PlaylistItem[]> {
  const results: PlaylistItem[] = []
  let pageToken: string | undefined

  while (true) {
    const params = `/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
    const data = await ytGet<{ items: PlaylistItem[]; nextPageToken?: string }>(params)

    for (const item of data.items ?? []) {
      const publishedAt = new Date(item.snippet.publishedAt)
      if (publishedAt < since) return results
      results.push(item)
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return results
}

await connectDB()

const filter = CREATOR_SLUG
  ? { slug: CREATOR_SLUG, isActive: true }
  : { isActive: true }

const creators = await Creator.find(filter).lean()
if (creators.length === 0) {
  log.error({ CREATOR_SLUG }, 'No matching creators found')
  process.exit(1)
}

log.info({ count: creators.length, since: SINCE.toISOString(), CREATOR_SLUG: CREATOR_SLUG ?? '(all)' }, 'Starting channel backfill')

let totalCreated = 0
let totalSkipped = 0
let totalShort = 0

for (const creator of creators) {
  try {
    log.info({ name: creator.name, slug: creator.slug }, 'Processing creator')

    const playlistId = await getUploadsPlaylistId(creator.youtubeChannelId)
    const items = await fetchVideosSince(playlistId, SINCE)
    const durations = await fetchDurations(items.map(i => i.snippet.resourceId.videoId))

    log.info({ name: creator.name, found: items.length, since: SINCE.toISOString().slice(0, 10) }, 'Videos found')

    let created = 0
    let skippedShort = 0
    for (const item of items) {
      const { title, publishedAt, thumbnails, resourceId } = item.snippet
      const youtubeVideoId = resourceId.videoId
      const durationSeconds = durations.get(youtubeVideoId)

      if (isTooShort(durationSeconds)) {
        skippedShort++
        log.debug({ title: title.slice(0, 60), durationSeconds }, 'Skipping short video')
        continue
      }

      const existing = await Video.findOneAndUpdate(
        { youtubeVideoId },
        {
          $setOnInsert: {
            creatorId: creator._id,
            creator: {
              slug: creator.slug,
              name: creator.name,
              handle: creator.handle,
              brandColor: creator.brandColor,
              initial: creator.initial,
              avatarUrl: creator.avatarUrl,
            },
            youtubeVideoId,
            title,
            url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
            thumbnailUrl: thumbnails?.medium?.url,
            durationSeconds,
            publishedAt: new Date(publishedAt),
            transcriptStatus: 'PENDING',
            analysisStatus: 'PENDING',
            language: creator.language,
            mentions: [],
          },
        },
        { upsert: true, new: false },
      )

      if (!existing) {
        if (!SKIP_ENQUEUE) {
          const video = await Video.findOne({ youtubeVideoId })
          if (video) {
            await transcribeQueue.add(
              'transcribe',
              { videoId: video._id.toString() },
              { jobId: `transcribe-${video._id}-backfill`, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
            )
            log.info({ title: title.slice(0, 70), publishedAt, durationSeconds }, 'Inserted + enqueued')
          }
        } else {
          log.info({ title: title.slice(0, 70), publishedAt, durationSeconds }, 'Inserted (enqueue skipped)')
        }
        created++
      } else {
        totalSkipped++
      }
    }

    totalCreated += created
    totalShort += skippedShort
    log.info({ name: creator.name, created, skippedShort, minSeconds: MIN_VIDEO_SECONDS }, 'Creator done')

    await new Promise(r => setTimeout(r, 500))
  } catch (err) {
    log.error({ name: creator.name, err: (err as Error).message }, 'Failed — skipping creator')
  }
}

log.info({ totalCreated, totalSkipped, totalShort }, 'Backfill complete')

if (!SKIP_ENQUEUE) await transcribeQueue.close()
await disconnectDB()
