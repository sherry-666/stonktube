/**
 * READ-ONLY report of what creators said about specific tickers, including the
 * PASSING mentions the public API filters out. Prints JSON to stdout.
 *
 * Deliberately uses the raw driver with only find() and does not import
 * @stonktube/db: registering its models could create indexes on connect.
 *
 *   node dist/audit-ticker-mentions.js --prod TRX PUMP > mentions.json
 *   node dist/audit-ticker-mentions.js TRX PUMP            # uses MONGODB_URI
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose from 'mongoose'

const MAX_NOTES = 15

const args = process.argv.slice(2)
const useProd = args.includes('--prod')
const tickers = args.filter((a) => !a.startsWith('--')).map((t) => t.toUpperCase())
if (tickers.length === 0) throw new Error('Pass at least one ticker')

const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI
if (!uri) throw new Error(`${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'} is not set`)
await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
const db = mongoose.connection.db
if (!db) throw new Error('DB not connected')

const stocks = await db
  .collection('stocks')
  .find(
    { ticker: { $in: tickers } },
    { projection: { ticker: 1, name: 1, priceSymbol: 1, aliases: 1, isPrivate: 1, createdAt: 1 } },
  )
  .toArray()

const report = []
for (const stock of stocks) {
  const prices = await db.collection('pricepoints').countDocuments({ 'meta.stockId': stock._id })
  const videos = await db
    .collection('videos')
    .find(
      { 'mentions.stockId': stock._id },
      { projection: { title: 1, publishedAt: 1, creatorId: 1, mentions: 1 } },
    )
    .sort({ publishedAt: -1 })
    .toArray()
  const mentions = videos.map((v) => {
    const m = (v.mentions as { stockId: mongoose.Types.ObjectId; note?: string; relevance?: string; sentiment?: string }[])
      .find((x) => x.stockId.equals(stock._id))
    return {
      videoId: v._id.toString(),
      publishedAt: new Date(v.publishedAt).toISOString().slice(0, 10),
      title: v.title as string,
      relevance: m?.relevance,
      sentiment: m?.sentiment,
      note: m?.note,
    }
  })
  report.push({
    ticker: stock.ticker,
    name: stock.name,
    priceSymbol: stock.priceSymbol,
    aliases: stock.aliases,
    isPrivate: stock.isPrivate,
    createdAt: stock.createdAt,
    storedPrices: prices,
    mentionCount: mentions.length,
    creatorCount: new Set(videos.map((v) => String(v.creatorId))).size,
    mentions: mentions.slice(0, MAX_NOTES),
  })
}
await mongoose.disconnect()

const found = new Set(report.map((r) => r.ticker))
console.log(JSON.stringify({ missing: tickers.filter((t) => !found.has(t)), report }, null, 2))
