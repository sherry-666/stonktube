import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'

await connectDB()

const creators = await Creator.find({ slug: { $in: ['andrei', 'kevin'] } })
const cIds = creators.map(c => c._id)
const videos = await Video.find({ creatorId: { $in: cIds }, transcriptStatus: 'CAPTIONS', analysisStatus: { $ne: 'ANALYZED' } })
console.log('Videos to analyze:', videos.length)
for (const v of videos) {
  const jobId = `analyze-${v._id}-${Date.now()}`
  await analyzeQueue.add('analyze', { videoId: v._id.toString() }, { jobId })
  console.log(' -', v.title?.slice(0, 50))
}

await analyzeQueue.close()
await disconnectDB()
