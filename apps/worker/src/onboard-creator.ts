/**
 * Onboard a new YouTube creator and backfill their recent videos.
 *
 * Usage (all env vars):
 *   CHANNEL_URL=https://www.youtube.com/@Handle \
 *   CREATOR_SLUG=my-slug \
 *   SINCE_DATE=2026-05-01T00:00:00.000Z \
 *   SKIP_ENQUEUE=true \
 *   CREATOR_COLOR=#2563EB \
 *   CREATOR_LANGUAGE=en \
 *   node dist/onboard-creator.js
 *
 * Required: CHANNEL_URL, CREATOR_SLUG, YOUTUBE_API_KEY, MONGODB_URI
 * Optional: SINCE_DATE (default: 2 months ago), SKIP_ENQUEUE (default: false),
 *           CREATOR_COLOR (default: #6366F1), CREATOR_LANGUAGE (default: en)
 */
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

const CHANNEL_URL = process.env.CHANNEL_URL
const CREATOR_SLUG = process.env.CREATOR_SLUG
const SKIP_ENQUEUE = process.env.SKIP_ENQUEUE === 'true'
const CREATOR_COLOR = process.env.CREATOR_COLOR ?? '#6366F1'
const CREATOR_LANGUAGE = process.env.CREATOR_LANGUAGE ?? 'en'

const twoMonthsAgo = new Date()
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
const SINCE = new Date(process.env.SINCE_DATE ?? twoMonthsAgo.toISOString())

if (!CHANNEL_URL) throw new Error('CHANNEL_URL is required')
if (!CREATOR_SLUG) throw new Error('CREATOR_SLUG is required')

async function ytGet<T>(path: string): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY not set')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${YT_API}${path}${sep}key=${key}`)
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function resolveChannelId(url: string): Promise<string> {
  // Handle /channel/UCxxx directly
  const channelMatch = url.match(/\/channel\/(UC[\w-]+)/)
  if (channelMatch) return channelMatch[1]

  // Resolve @handle or custom URL via YouTube search API
  const handle = url.match(/@([\w.-]+)/)?.[1] ?? url.split('/').pop()!
  const data = await ytGet<{ items?: { id: string }[] }>(
    `/channels?part=id&forHandle=@${handle}`,
  )
  const id = data.items?.[0]?.id
  if (!id) throw new Error(`Could not resolve channel ID from URL: ${url}`)
  return id
}

interface ChannelSnippet {
  title: string
  description: string
  customUrl?: string
  defaultLanguage?: string
  thumbnails?: { default?: { url: string }; medium?: { url: string } }
}

interface ChannelStatistics {
  subscriberCount?: string
}

async function fetchChannelMeta(channelId: string) {
  const data = await ytGet<{
    items: { snippet: ChannelSnippet; statistics: ChannelStatistics; contentDetails: { relatedPlaylists: { uploads: string } } }[]
  }>(`/channels?part=snippet,statistics,contentDetails&id=${channelId}`)
  const item = data.items?.[0]
  if (!item) throw new Error(`Channel not found: ${channelId}`)
  return item
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
      if (new Date(item.snippet.publishedAt) < since) return results
      results.push(item)
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return results
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

await connectDB()

// Step 1: resolve channel and upsert creator
log.info({ url: CHANNEL_URL }, 'Resolving channel')
const channelId = await resolveChannelId(CHANNEL_URL)
const { snippet, statistics, contentDetails } = await fetchChannelMeta(channelId)

const handle = snippet.customUrl?.startsWith('@') ? snippet.customUrl : `@${snippet.customUrl ?? CREATOR_SLUG}`
const language = CREATOR_LANGUAGE !== 'en' ? CREATOR_LANGUAGE : (snippet.defaultLanguage ?? 'en')
const avatarUrl = snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url
const subscriberCount = statistics.subscriberCount ? parseInt(statistics.subscriberCount) : undefined

const creatorData = {
  slug: CREATOR_SLUG,
  name: snippet.title,
  handle,
  youtubeChannelId: channelId,
  channelUrl: `https://www.youtube.com/${handle}`,
  brandColor: CREATOR_COLOR,
  initial: snippet.title.replace(/[^a-zA-Z一-鿿가-힯]/g, '')[0]?.toUpperCase() ?? CREATOR_SLUG[0].toUpperCase(),
  language,
  bio: snippet.description.split('\n')[0].slice(0, 300),
  aliases: [snippet.title, CREATOR_SLUG],
  isActive: true,
  ...(avatarUrl && { avatarUrl }),
  ...(subscriberCount && { subscriberCount }),
}

const existing = await Creator.findOne({ slug: CREATOR_SLUG })
if (existing) {
  log.info({ slug: CREATOR_SLUG }, 'Creator exists — updating')
  await Creator.updateOne({ slug: CREATOR_SLUG }, { $set: creatorData })
} else {
  await Creator.create(creatorData)
  log.info({ slug: CREATOR_SLUG, name: snippet.title, channelId }, 'Creator inserted')
}

const creator = await Creator.findOne({ slug: CREATOR_SLUG }).lean()
if (!creator) throw new Error('Creator not found after upsert')

// Step 2: backfill videos
log.info({ slug: CREATOR_SLUG, since: SINCE.toISOString().slice(0, 10) }, 'Starting video backfill')

const uploadsPlaylistId = contentDetails.relatedPlaylists.uploads
const items = await fetchVideosSince(uploadsPlaylistId, SINCE)
const durations = await fetchDurations(items.map(i => i.snippet.resourceId.videoId))

log.info({ found: items.length }, 'Videos found')

let created = 0
let skippedExisting = 0
let skippedShort = 0

for (const item of items) {
  const { title, publishedAt, thumbnails, resourceId } = item.snippet
  const youtubeVideoId = resourceId.videoId
  const durationSeconds = durations.get(youtubeVideoId)

  if (isTooShort(durationSeconds)) {
    skippedShort++
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
    skippedExisting++
  }
}

log.info({ created, skippedExisting, skippedShort, minSeconds: MIN_VIDEO_SECONDS }, 'Backfill complete')

if (!SKIP_ENQUEUE) await transcribeQueue.close()
await disconnectDB()
