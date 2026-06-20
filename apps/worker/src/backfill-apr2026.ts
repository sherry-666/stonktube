import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const YT_API = 'https://www.googleapis.com/youtube/v3'
const SINCE = new Date('2026-04-01T00:00:00.000Z')

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

  // Playlist is newest-first; keep paginating until we hit a video older than since
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

const creators = await Creator.find({ isActive: true }).lean()
log.info({ count: creators.length, since: SINCE.toISOString() }, 'Starting backfill')

let totalCreated = 0
let totalSkipped = 0

for (const creator of creators) {
  try {
    log.info({ name: creator.name }, 'Processing creator')

    const playlistId = await getUploadsPlaylistId(creator.youtubeChannelId)
    const items = await fetchVideosSince(playlistId, SINCE)

    log.info({ name: creator.name, found: items.length }, 'Videos found since Apr 2026')

    let created = 0
    for (const item of items) {
      const { title, publishedAt, thumbnails, resourceId } = item.snippet
      const youtubeVideoId = resourceId.videoId

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
        const video = await Video.findOne({ youtubeVideoId })
        if (video) {
          await transcribeQueue.add(
            'transcribe',
            { videoId: video._id.toString() },
            { jobId: `transcribe-${video._id}-backfill`, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
          )
          log.info({ title: title.slice(0, 70), publishedAt }, 'Enqueued')
          created++
        }
      } else {
        totalSkipped++
      }
    }

    totalCreated += created
    log.info({ name: creator.name, created, skipped: items.length - created }, 'Creator done')

    // Brief pause between creators to avoid hammering the YouTube quota
    await new Promise(r => setTimeout(r, 500))
  } catch (err) {
    log.error({ name: creator.name, err: (err as Error).message }, 'Failed — skipping creator')
  }
}

log.info({ totalCreated, totalSkipped }, 'Backfill complete')

await transcribeQueue.close()
await disconnectDB()
