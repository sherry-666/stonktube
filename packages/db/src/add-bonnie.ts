import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'bonnie',
  name: '邦妮區塊鏈 Bonnie Blockchain',
  handle: '@BonnieBlockchain',
  youtubeChannelId: 'UCjlPLMYEsq0pjgLL1q24mSg',
  channelUrl: 'https://www.youtube.com/@BonnieBlockchain',
  brandColor: '#7C3AED',
  initial: 'B',
  language: 'zh',
  bio: 'Traditional Chinese-language crypto and blockchain education covering Bitcoin, DeFi, Web3, and interviews with industry leaders.',
  aliases: ['邦妮區塊鏈', 'Bonnie Blockchain', 'BonnieBlockchain'],
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
