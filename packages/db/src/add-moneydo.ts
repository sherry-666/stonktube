import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'moneydo',
  name: "Jun's economy lab",
  handle: '@moneydo',
  youtubeChannelId: 'UCznImSIaxZR7fdLCICLdgaQ',
  channelUrl: 'https://www.youtube.com/@moneydo',
  brandColor: '#059669',
  initial: 'J',
  language: 'ko',
  bio: 'Korean-language channel covering economy, US stocks, real estate, and personal finance for everyday investors.',
  aliases: ["Jun's economy lab", 'moneydo', '경제'],
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
