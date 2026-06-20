import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CREATOR = {
  slug: 'rhino',
  name: 'Rhino Finance',
  handle: '@RhinoFinance',
  youtubeChannelId: 'UCFQsi7WaF5X41tcuOryDk8w',
  channelUrl: 'https://www.youtube.com/@RhinoFinance',
  brandColor: '#DC2626',
  initial: 'R',
  language: 'zh',
  bio: 'Chinese-language global market analysis covering US stocks, macro trends, and investment opportunities.',
  aliases: ['视野环球财经', 'Rhino Finance', 'RhinoFinance'],
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
