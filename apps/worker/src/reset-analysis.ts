import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'

await connectDB()

// Reset all Gemini-analyzed videos to PENDING so they re-run with BTC/ETH in the ticker map
const videos = await Video.find({ analysisStatus: 'ANALYZED', summary: { $exists: true } })
console.log(`Found ${videos.length} analyzed videos to re-queue`)

for (const v of videos) {
  await v.updateOne({ analysisStatus: 'PENDING', mentions: [] })
  await analyzeQueue.add('analyze', { videoId: v._id.toString() }, { jobId: `analyze-${v._id}-btc-${Date.now()}` })
  console.log(' -', v.title?.slice(0, 60))
}

await analyzeQueue.close()
await disconnectDB()
