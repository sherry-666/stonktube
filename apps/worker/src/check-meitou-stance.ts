import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'

await connectDB()

const creator = await Creator.findOne({ slug: 'meitou-news' }).lean()
console.log('creator:', creator?.name)

const analyzed = await Video.countDocuments({ creatorId: creator!._id, analysisStatus: 'ANALYZED' })
console.log('analyzed videos:', analyzed)

const agg = await Video.aggregate([
  { $match: { creatorId: creator!._id, analysisStatus: 'ANALYZED' } },
  { $unwind: '$mentions' },
  {
    $group: {
      _id: { stance: '$mentions.stance', sentiment: '$mentions.sentiment' },
      count: { $sum: 1 },
    },
  },
  { $sort: { '_id.stance': 1, '_id.sentiment': 1 } },
])
console.log('\nstance x sentiment breakdown:')
for (const r of agg) console.log(' ', String(r._id.stance), r._id.sentiment, '->', r.count)

const opinionSamples = await Video.aggregate([
  { $match: { creatorId: creator!._id, analysisStatus: 'ANALYZED' } },
  { $unwind: '$mentions' },
  { $match: { 'mentions.stance': 'OPINION', 'mentions.sentiment': { $in: ['BULLISH', 'BEARISH'] } } },
  {
    $project: {
      _id: 0,
      title: 1,
      ticker: '$mentions.ticker',
      sentiment: '$mentions.sentiment',
      note: '$mentions.note',
    },
  },
  { $limit: 8 },
])
console.log('\nOPINION samples (counted in sentiment):')
for (const s of opinionSamples) {
  console.log(' ', s.ticker, s.sentiment, '|', String(s.note ?? '').slice(0, 100))
}

const factualSamples = await Video.aggregate([
  { $match: { creatorId: creator!._id, analysisStatus: 'ANALYZED' } },
  { $unwind: '$mentions' },
  { $match: { 'mentions.stance': 'FACTUAL', 'mentions.sentiment': { $in: ['BULLISH', 'BEARISH'] } } },
  {
    $project: {
      _id: 0,
      title: 1,
      ticker: '$mentions.ticker',
      sentiment: '$mentions.sentiment',
      note: '$mentions.note',
    },
  },
  { $limit: 8 },
])
console.log('\nFACTUAL samples (excluded from sentiment):')
for (const s of factualSamples) {
  console.log(' ', s.ticker, s.sentiment, '|', String(s.note ?? '').slice(0, 100))
}

await disconnectDB()
