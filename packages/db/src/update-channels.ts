import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const CHANNELS = [
  { slug: 'bella',  youtubeChannelId: 'UCVomjkM_t0EcctTWSE1Jvxg', channelUrl: 'https://www.youtube.com/@bellafinance' },
  { slug: 'mei',    youtubeChannelId: 'UCBUH38E0ngqvmTqdchWunwQ', channelUrl: 'https://www.youtube.com/@MeiTouJun' },
  { slug: 'joseph', youtubeChannelId: 'UCbta0n8i6Rljh0obO7HzG9A', channelUrl: 'https://www.youtube.com/@josephcarlsonshow' },
  { slug: 'andrei', youtubeChannelId: 'UCGy7SkBjcIAgTiwkXEtPnYg', channelUrl: 'https://www.youtube.com/@andreijikh' },
  { slug: 'tom',    youtubeChannelId: 'UCORi3Jj7kSHcdHdckrjhOsg', channelUrl: 'https://www.youtube.com/@tomnash' },
  { slug: 'kevin',  youtubeChannelId: 'UCUvvj5lwue7PspotMDjk5UA', channelUrl: 'https://www.youtube.com/@meetkevin' },
  { slug: 'rhino',  youtubeChannelId: 'UCFQsi7WaF5X41tcuOryDk8w', channelUrl: 'https://www.youtube.com/@RhinoFinance' },
]

await connectDB()
for (const c of CHANNELS) {
  const r = await Creator.updateOne({ slug: c.slug }, { $set: { youtubeChannelId: c.youtubeChannelId, channelUrl: c.channelUrl } })
  console.log(c.slug, '->', c.youtubeChannelId, r.modifiedCount ? '✓' : 'NOT FOUND')
}
await disconnectDB()
