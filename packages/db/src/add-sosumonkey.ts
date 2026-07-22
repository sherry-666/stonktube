import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'sosumonkey',
  name: '소수몽키',
  handle: '@sosumonkey',
  youtubeChannelId: 'UCC3yfxS5qC6PCwDzetUuEWg',
  channelUrl: 'https://www.youtube.com/@sosumonkey',
  brandColor: '#D97706',
  initial: 'S',
  language: 'ko',
  bio: 'Korean-language stock analysis and investing education covering US and global markets.',
  aliases: ['소수몽키', 'SosuMonkey', 'sosumonkey'],
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
