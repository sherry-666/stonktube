import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'

await connectDB()
const videos = await Video.find({ analysisStatus: { $in: ['ANALYZED', 'NO_MENTIONS'] }, summary: { $exists: true } }).sort({ publishedAt: -1 }).limit(10)
for (const v of videos) {
  console.log(`\n${v.title}`)
  console.log(`  summary: ${v.summary}`)
  console.log(`  mentions: ${JSON.stringify(v.mentions?.map((m: any) => `${m.ticker}:${m.sentiment}`))}`)
}
await disconnectDB()
