import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'marketbeat',
  name: 'MarketBeat',
  handle: '@MarketBeatMedia',
  youtubeChannelId: 'UCRlSRxRWq0PSL74uicr6KSQ',
  channelUrl: 'https://www.youtube.com/@MarketBeatMedia',
  brandColor: '#2563EB',
  initial: 'M',
  language: 'en',
  bio: 'Stock market research and financial analysis covering earnings, analyst ratings, and investment insights.',
  aliases: ['MarketBeat', 'MarketBeat Media', 'marketbeatcom'],
  isActive: true,
}

await connectDB()

const existing = await Creator.findOne({ slug: CREATOR.slug })
if (existing) {
  console.log(`Creator "${CREATOR.slug}" already exists — updating`)
  await Creator.updateOne({ slug: CREATOR.slug }, { $set: CREATOR })
  console.log('Updated.')
} else {
  await Creator.create(CREATOR)
  console.log(`Created creator: ${CREATOR.name} (${CREATOR.youtubeChannelId})`)
}

await disconnectDB()
