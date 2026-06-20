import mongoose, { Types } from 'mongoose'
import { Stock } from './models/Stock.js'
import { Video } from './models/Video.js'

function collection() {
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')
  return db.collection('pricepoints')
}

function downsample(prices: number[], targetLen: number): number[] {
  if (prices.length <= targetLen) return prices
  const result: number[] = []
  const step = (prices.length - 1) / (targetLen - 1)
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.round(i * step)
    result.push(prices[Math.min(idx, prices.length - 1)])
  }
  return result
}

export async function rebuildStats(stockId?: string): Promise<void> {
  const filter = stockId ? { _id: new Types.ObjectId(stockId) } : {}
  const stocks = await Stock.find(filter).lean()

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  for (const stock of stocks) {
    // ── 1. Aggregate mentions ─────────────────────────────────────────────────
    const videos = await Video.find({
      'mentions.stockId': stock._id,
      analysisStatus: 'ANALYZED',
    }).lean()

    let bullCount = 0
    let neutralCount = 0
    let bearCount = 0
    let bull7d = 0
    let neutral7d = 0
    let bear7d = 0
    let mentions30d = 0
    const creatorSet = new Set<string>()

    for (const video of videos) {
      for (const mention of video.mentions) {
        if (!mention.stockId.equals(stock._id)) continue
        if (mention.sentiment === 'BULLISH') bullCount++
        else if (mention.sentiment === 'NEUTRAL') neutralCount++
        else if (mention.sentiment === 'BEARISH') bearCount++
        creatorSet.add(video.creatorId.toString())
        if (video.publishedAt >= thirtyDaysAgo) mentions30d++
        if (video.publishedAt >= sevenDaysAgo) {
          if (mention.sentiment === 'BULLISH') bull7d++
          else if (mention.sentiment === 'NEUTRAL') neutral7d++
          else if (mention.sentiment === 'BEARISH') bear7d++
        }
      }
    }

    const total7d = bull7d + neutral7d + bear7d
    const bullishPct = total7d > 0 ? Math.round((bull7d / total7d) * 100) : 0
    const distinctCreators = creatorSet.size

    // ── 2. Price series ───────────────────────────────────────────────────────
    // Collapse duplicate points per calendar day before limiting, otherwise
    // repeated bars for recent dates (the fill job stores overlapping ranges)
    // crowd out real history and flat-line the stats.
    const allPrices = await collection()
      .aggregate([
        { $match: { 'meta.stockId': stock._id } },
        { $sort: { date: 1 } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
            close: { $last: '$close' },
            date: { $last: '$date' },
          },
        },
        { $sort: { date: -1 } },
        { $limit: 260 },
      ])
      .toArray()

    // allPrices is newest-first, reverse to oldest-first
    allPrices.reverse()

    const closes = allPrices.map((p) => p.close as number)

    let latestClose: number | undefined
    let dayChangePct: number | undefined
    let change30dPct: number | undefined
    let sparkline: number[] = []

    if (closes.length > 0) {
      latestClose = closes[closes.length - 1]
      if (closes.length >= 2) {
        const prev = closes[closes.length - 2]
        dayChangePct = prev !== 0 ? ((latestClose - prev) / prev) * 100 : 0
      }
      // 22 trading days ≈ 1 month
      if (closes.length >= 23) {
        const base = closes[closes.length - 23]
        change30dPct = base !== 0 ? ((latestClose - base) / base) * 100 : 0
      }
      sparkline = downsample(closes, 30)
    }

    // ── 3. Backfill priceAtMention ────────────────────────────────────────────
    for (const video of videos) {
      const publishedAt = video.publishedAt

      // Find closest price on or before publishedAt from allPrices (oldest-first)
      let closestPrice: number | undefined
      for (let i = allPrices.length - 1; i >= 0; i--) {
        const priceDate = allPrices[i].date as Date
        if (priceDate <= publishedAt) {
          closestPrice = allPrices[i].close as number
          break
        }
      }

      if (closestPrice != null) {
        await Video.updateOne(
          { _id: video._id, 'mentions.stockId': stock._id },
          { $set: { 'mentions.$.priceAtMention': closestPrice } },
        )
      }
    }

    // ── 4. Write stats ────────────────────────────────────────────────────────
    await Stock.findByIdAndUpdate(stock._id, {
      $set: {
        stats: {
          mentions30d,
          distinctCreators,
          bullCount,
          neutralCount,
          bearCount,
          bullishPct,
          latestClose,
          dayChangePct,
          change30dPct,
          sparkline,
          computedAt: now,
        },
      },
    })
  }
}
