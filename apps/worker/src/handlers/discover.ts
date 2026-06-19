import type { Job } from 'bullmq'
import { Creator, Video } from '@stonktube/db'
import { transcribeQueue } from '@stonktube/pipeline'
import type { DiscoverJob } from '@stonktube/shared'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const YT_API = 'https://www.googleapis.com/youtube/v3'

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

async function fetchRecentVideos(
  playlistId: string,
  since: Date,
  maxPages = 5,
): Promise<PlaylistItem[]> {
  const results: PlaylistItem[] = []
  let pageToken: string | undefined
  let page = 0

  while (page < maxPages) {
    const params = `/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
    const data = await ytGet<{ items: PlaylistItem[]; nextPageToken?: string }>(params)

    for (const item of data.items ?? []) {
      const publishedAt = new Date(item.snippet.publishedAt)
      log.debug({ title: item.snippet.title.slice(0, 50), publishedAt: publishedAt.toISOString(), since: since.toISOString() }, 'Checking video')
      if (publishedAt <= since) return results // playlist is newest-first
      results.push(item)
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
    page++
  }

  return results
}

export async function handleDiscover(job: Job<DiscoverJob>) {
  const { creatorId } = job.data

  const creator = await Creator.findById(creatorId)
  if (!creator) throw new Error(`Creator not found: ${creatorId}`)

  log.info({ creatorId, name: creator.name }, 'Discovering videos')

  const uploadsPlaylistId = await getUploadsPlaylistId(creator.youtubeChannelId)

  const latest = await Video.findOne({ creatorId: creator._id }).sort({ publishedAt: -1 })

  // Truncate to start-of-day so intra-day timestamp differences don't block same-day real videos
  let since = latest?.publishedAt ?? new Date(Date.now() - 30 * 86400_000)
  since = new Date(since.toISOString().slice(0, 10))
  log.info({ creatorId: creator.name, since: since.toISOString() }, 'Discovering since')

  const items = await fetchRecentVideos(uploadsPlaylistId, since)

  let created = 0
  for (const item of items) {
    const { title, publishedAt, thumbnails, resourceId } = item.snippet
    const youtubeVideoId = resourceId.videoId

    // new: false → returns old doc (or null if freshly upserted)
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
      // Truly new video — fetch the inserted doc to get its _id
      const video = await Video.findOne({ youtubeVideoId })
      if (video) {
        await transcribeQueue.add(
          'transcribe',
          { videoId: video._id.toString() },
          { jobId: `transcribe-${video._id}`, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
        )
        created++
      }
    }
  }

  log.info({ creatorId, found: items.length, created }, 'Discovery complete')
}
