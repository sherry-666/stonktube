/**
 * Removes all seeded mock data while preserving creators and stocks.
 * Run once before switching to real pipeline data.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose from 'mongoose'
import { connectDB, disconnectDB } from './index.js'

await connectDB()
const db = mongoose.connection.db!

// Remove all videos (seeded and any partially-discovered real ones) — pipeline will re-discover
const vids = await db.collection('videos').deleteMany({})
console.log('Deleted videos:', vids.deletedCount)

// Remove all transcripts
const txs = await db.collection('transcripts').deleteMany({})
console.log('Deleted transcripts:', txs.deletedCount)

// Remove all price points
const pts = await db.collection('pricepoints').deleteMany({})
console.log('Deleted price points:', pts.deletedCount)

// Reset stock stats (trackedBy, mentions, sentiment rollups)
const stocks = await db.collection('stocks').updateMany({}, {
  $set: {
    trackedBy: 0,
    mentionCount30d: 0,
    bullishPct: 0,
    sentiment: { bullCount: 0, neutralCount: 0, bearCount: 0, totalCount: 0 },
  },
})
console.log('Reset stock stats:', stocks.modifiedCount)

// Reset creator stats
const creators = await db.collection('creators').updateMany({}, {
  $set: { videoCount: 0 },
})
console.log('Reset creator stats:', creators.modifiedCount)

console.log('\nDone. Now run: node apps/scheduler/dist/index.js')
await disconnectDB()
