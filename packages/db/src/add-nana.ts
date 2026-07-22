import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'nana',
  name: 'NaNa说美股',
  handle: '@NaNaShuoMeiGu',
  youtubeChannelId: 'UCFhJ8ZFg9W4kLwFTBBNIjOw',
  channelUrl: 'https://www.youtube.com/@NaNaShuoMeiGu',
  brandColor: '#DC2626',
  initial: 'N',
  language: 'zh',
  bio: 'Chinese-language US stock analysis and market commentary covering individual stocks, technical analysis, and market trends.',
  aliases: ['NaNa说美股', 'NaNaShuoMeiGu', 'NaNa'],
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
