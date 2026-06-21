import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'

await connectDB()

// 1. Overall coverage: how many analyzed videos / mentions now carry stance?
const analyzed = await Video.countDocuments({ analysisStatus: 'ANALYZED' })

const agg = await Video.aggregate([
  { $match: { analysisStatus: 'ANALYZED' } },
  { $unwind: '$mentions' },
  {
    $group: {
      _id: '$mentions.stance',
      count: { $sum: 1 },
    },
  },
])

const videosWithStance = await Video.countDocuments({
  analysisStatus: 'ANALYZED',
  'mentions.stance': { $exists: true },
})

console.log('=== Stance coverage ===')
console.log('analyzed videos:', analyzed)
console.log('videos with >=1 stance-tagged mention:', videosWithStance)
console.log('mention stance breakdown:', JSON.stringify(agg))

// 2. Spot-check: find FACTUAL mentions whose sentiment is BEARISH/BULLISH —
// these are exactly the cases the ticket is about (factual recap that used to
// be counted as directional sentiment). Show a few notes.
const examples = await Video.aggregate([
  { $match: { analysisStatus: 'ANALYZED' } },
  { $unwind: '$mentions' },
  {
    $match: {
      'mentions.stance': 'FACTUAL',
      'mentions.sentiment': { $in: ['BEARISH', 'BULLISH'] },
    },
  },
  {
    $project: {
      _id: 0,
      ticker: '$mentions.ticker',
      sentiment: '$mentions.sentiment',
      stance: '$mentions.stance',
      note: '$mentions.note',
      title: 1,
    },
  },
  { $limit: 8 },
])

console.log('\n=== FACTUAL mentions with directional sentiment (now excluded from counts) ===')
for (const e of examples) {
  console.log(`  [${e.ticker}] ${e.sentiment}/${e.stance} — ${(e.note ?? '').slice(0, 90)}`)
}

await disconnectDB()
