import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { Queue } from 'bullmq'
import { connectDB, disconnectDB, Creator } from '@stonktube/db'

const conn = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }
const discoverQueue = new Queue('discover', { connection: conn })

await connectDB()
const creators = await Creator.find({ isActive: true }, '_id slug name')
for (const c of creators) {
  const jobId = `discover-${c._id}-test-${Date.now()}`
  await discoverQueue.add('discover', { creatorId: c._id.toString(), runId: 'manual-test' }, { jobId })
  console.log(`Enqueued: ${c.name} (${jobId})`)
}
await discoverQueue.close()
await disconnectDB()
