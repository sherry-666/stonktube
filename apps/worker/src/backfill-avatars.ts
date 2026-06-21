/**
 * Backfill creator profile pictures (avatarUrl) + subscriberCount from the
 * YouTube Data API. The UI already renders avatarUrl with an initials fallback;
 * this just populates it for existing creators.
 *
 *   node dist/backfill-avatars.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from '@stonktube/db'

const KEY = process.env.YOUTUBE_API_KEY
if (!KEY) throw new Error('YOUTUBE_API_KEY not set')

await connectDB()

const creators = await Creator.find({})
for (const c of creators) {
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${c.youtubeChannelId}&key=${KEY}`,
    )
    const j = (await r.json()) as {
      items?: { snippet?: { thumbnails?: Record<string, { url: string }> }; statistics?: { subscriberCount?: string } }[]
    }
    const item = j.items?.[0]
    const thumbs = item?.snippet?.thumbnails
    const avatarUrl = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url
    const subs = item?.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : undefined

    if (!avatarUrl) {
      console.log(`${c.name}: no thumbnail found`)
      continue
    }
    await Creator.updateOne(
      { _id: c._id },
      { $set: { avatarUrl, ...(subs != null ? { subscriberCount: subs } : {}) } },
    )
    console.log(`${c.name}: avatar set${subs != null ? ` · ${subs.toLocaleString()} subs` : ''}`)
  } catch (err) {
    console.warn(`${c.name}: failed — ${(err as Error).message}`)
  }
}

await disconnectDB()
process.exit(0)
