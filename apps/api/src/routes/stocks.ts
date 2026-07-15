import type { FastifyPluginAsync } from 'fastify'
import { Stock, Video, getPrices } from '@stonktube/db'
import { mentionQualifies, mentionExpressesView } from '@stonktube/shared'
import { Types } from 'mongoose'
import { getVideoTranslation } from '../lib/videoTranslation.js'
import { getStockTranslationsBatch, getStockTranslation } from '../lib/stockTranslation.js'

function displayTicker(ticker: string): string {
  return ticker.replace(/-USD$/, '')
}

// Company logo by ticker (Financial Modeling Prep). 404s for indices/odd
// symbols, so the client falls back to the initials badge on image error.
function fmpLogo(ticker: string): string {
  return `https://financialmodelingprep.com/image-stock/${displayTicker(ticker)}.png`
}

function fmtPrice(n?: number): string {
  return n != null ? `$${n.toFixed(2)}` : ''
}

function fmtPct(n?: number): string {
  const s = n != null ? n.toFixed(2) : '0.00'
  return n != null && n >= 0 ? `+${s}%` : `${s}%`
}

function verdict(bullishPct: number): string {
  if (bullishPct >= 80) return 'Strong buy'
  if (bullishPct >= 60) return 'Buy'
  if (bullishPct >= 40) return 'Mixed'
  if (bullishPct >= 20) return 'Cautious'
  return 'Bearish'
}

const TF_DAYS: Record<string, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 132,
  '1Y': 260,
}

const stocks: FastifyPluginAsync = async (fastify) => {
  // GET /api/stocks?sort=mentions|bull|chg|price|ticker&lang=en|zh|ko
  fastify.get<{ Querystring: { sort?: string; lang?: string } }>('/api/stocks', async (req, reply) => {
    const sort = req.query.sort ?? 'mentions'
    const lang = req.query.lang ?? 'en'
    const all = await Stock.find({}).lean()

    // Value + whether the stock actually has data for the active sort, so
    // data-less stocks (no price / no mentions) sink to the bottom instead of
    // being treated as 0 and floating to the top of e.g. "Top movers".
    const metric = (s: (typeof all)[number]): { v: number; has: boolean } => {
      const st = s.stats
      switch (sort) {
        case 'bull': {
          const total = (st?.bullCount ?? 0) + (st?.neutralCount ?? 0) + (st?.bearCount ?? 0)
          return { v: st?.bullishPct ?? 0, has: total > 0 }
        }
        case 'chg':
          return { v: st?.change30dPct ?? 0, has: st?.change30dPct != null }
        case 'price':
          return { v: st?.latestClose ?? 0, has: st?.latestClose != null }
        case 'mentions':
        default:
          return { v: st?.mentions30d ?? 0, has: (st?.mentions30d ?? 0) > 0 }
      }
    }

    const sorted = [...all].sort((a, b) => {
      if (sort === 'ticker') return a.ticker.localeCompare(b.ticker)
      const A = metric(a)
      const B = metric(b)
      if (A.has !== B.has) return A.has ? -1 : 1 // data-less to the bottom
      return B.v - A.v
    })

    const names = await getStockTranslationsBatch(sorted, lang)

    const rows = sorted.map((s, i) => ({
      // Raw ticker — unique per stock; use as a stable React key. (The display
      // ticker strips -USD and can collide, e.g. XAG vs XAG-USD.)
      id: s.ticker,
      ticker: displayTicker(s.ticker),
      name: names[i].name,
      sector: names[i].sector,
      isPrivate: s.isPrivate,
      brandColor: s.brandColor,
      logoBg: s.logoBg,
      initials: s.initials,
      logoUrl: s.logoUrl || fmpLogo(s.ticker),
      priceStr: fmtPrice(s.stats?.latestClose),
      dayChangePct: s.stats?.dayChangePct ?? 0,
      dayChangeStr: fmtPct(s.stats?.dayChangePct),
      change30dPct: s.stats?.change30dPct ?? 0,
      sparkline: s.stats?.sparkline ?? [],
      sentiment: {
        bullCount: s.stats?.bullCount ?? 0,
        neutralCount: s.stats?.neutralCount ?? 0,
        bearCount: s.stats?.bearCount ?? 0,
        bullishPct: s.stats?.bullishPct ?? 0,
        neutralPct: s.stats?.neutralPct ?? 0,
        bearishPct: s.stats?.bearishPct ?? 0,
        recentRatings: s.stats?.recentRatings ?? 0,
      },
      mentions30d: s.stats?.mentions30d ?? 0,
      distinctCreators: s.stats?.distinctCreators ?? 0,
    }))

    return reply.send(rows)
  })

  // GET /api/stocks/:ticker?tf=1M|3M|6M|1Y&lang=en|zh|ko
  fastify.get<{ Params: { ticker: string }; Querystring: { tf?: string; lang?: string } }>(
    '/api/stocks/:ticker',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase()
      const tf = req.query.tf ?? '3M'
      const lang = req.query.lang ?? 'en'
      const tfDays = TF_DAYS[tf] ?? TF_DAYS['3M']

      const stock = await Stock.findOne({ ticker }).lean()
      if (!stock) return reply.code(404).send({ error: 'Stock not found' })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - tfDays * 1.5) // buffer for weekends

      const [pricePoints, videos] = await Promise.all([
        getPrices(stock._id as Types.ObjectId, startDate),
        Video.find({
          'mentions.stockId': stock._id,
          analysisStatus: 'ANALYZED',
        })
          .sort({ publishedAt: -1 })
          .lean(),
      ])

      // Take last tfDays price points
      const priceSeries = pricePoints.slice(-tfDays).map((p) => ({
        date: (p.date as Date).toISOString().split('T')[0],
        close: p.close as number,
      }))

      // Overall sentiment: last 7 days only
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      let bullCount = 0
      let neutralCount = 0
      let bearCount = 0

      for (const video of videos) {
        if (video.publishedAt < sevenDaysAgo) continue
        for (const mention of video.mentions) {
          if (!mention.stockId.equals(stock._id as Types.ObjectId)) continue
          if (!mentionQualifies(mention)) continue
          // Exclude bare factual recaps — only the creator's own view counts.
          if (!mentionExpressesView(mention)) continue
          if (mention.sentiment === 'BULLISH') bullCount++
          else if (mention.sentiment === 'NEUTRAL') neutralCount++
          else if (mention.sentiment === 'BEARISH') bearCount++
        }
      }

      const total = bullCount + neutralCount + bearCount
      const bullishPct = total > 0 ? Math.round((bullCount / total) * 100) : 0
      const neutralPct = total > 0 ? Math.round((neutralCount / total) * 100) : 0
      const bearishPct = total > 0 ? Math.round((bearCount / total) * 100) : 0

      const overallSentiment = {
        total,
        bullCount,
        neutralCount,
        bearCount,
        bullishPct,
        neutralPct,
        bearishPct,
        verdict: verdict(bullishPct),
      }

      // Recent coverage: videos sorted by publishedAt desc, limit 10. Each row
      // shows the creator's sentiment on this stock, so only include videos
      // whose mention of it expresses a view (skip bare factual recaps).
      const coverageVideos = videos
        .filter((v) => {
          const m = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))
          return m != null && mentionExpressesView(m)
        })
        .slice(0, 10)

      const recentCoverage = await Promise.all(
        coverageVideos.map(async (v) => {
          const mention = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))
          const tx = await getVideoTranslation(v , lang)
          return {
            videoId: v._id.toString(),
            creatorSlug: v.creator.slug,
            creatorName: v.creator.name,
            creatorHandle: v.creator.handle,
            creatorColor: v.creator.brandColor,
            creatorInitial: v.creator.initial,
            creatorAvatarUrl: v.creator.avatarUrl,
            publishedAt: v.publishedAt.toISOString(),
            title: tx.title,
            url: v.url,
            note: tx.noteByTicker[mention?.ticker ?? ''] ?? mention?.note ?? '',
            sentiment: mention?.sentiment ?? 'NEUTRAL',
            stance: mention?.stance,
            priceAtMention: mention?.priceAtMention,
            priceStr: fmtPrice(mention?.priceAtMention),
          }
        }),
      )

      const trackedBy = new Set(
        videos
          .filter((v) =>
            v.mentions.some(
              (m) => m.stockId.equals(stock._id as Types.ObjectId) && mentionQualifies(m),
            ),
          )
          .map((v) => v.creatorId.toString()),
      ).size

      const stockNames = await getStockTranslation(stock, lang)

      return reply.send({
        stock: {
          ticker: displayTicker(stock.ticker),
          name: stockNames.name,
          sector: stockNames.sector,
          isPrivate: stock.isPrivate,
          brandColor: stock.brandColor,
          logoBg: stock.logoBg,
          initials: stock.initials,
          logoUrl: stock.logoUrl || fmpLogo(stock.ticker),
          priceStr: fmtPrice(stock.stats?.latestClose),
          dayChangePct: stock.stats?.dayChangePct ?? 0,
          dayChangeStr: fmtPct(stock.stats?.dayChangePct),
          trackedBy,
        },
        priceSeries,
        overallSentiment,
        recentCoverage,
      })
    },
  )

  // GET /api/stocks/:ticker/markers?tf=&lang=
  fastify.get<{ Params: { ticker: string }; Querystring: { tf?: string; lang?: string } }>(
    '/api/stocks/:ticker/markers',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase()
      const tf = req.query.tf ?? '3M'
      const lang = req.query.lang ?? 'en'
      const tfDays = TF_DAYS[tf] ?? TF_DAYS['3M']

      const stock = await Stock.findOne({ ticker }).lean()
      if (!stock) return reply.code(404).send({ error: 'Stock not found' })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - tfDays * 1.5) // buffer for weekends

      const [videos, prices] = await Promise.all([
        Video.find({
          'mentions.stockId': stock._id,
          publishedAt: { $gte: startDate },
          analysisStatus: 'ANALYZED',
        })
          .sort({ publishedAt: -1 })
          .lean(),
        // Load price dates so we can snap each marker to an actual trading day,
        // not just the nearest weekday (holidays can also have no price).
        getPrices(stock._id, startDate),
      ])

      // Sorted ascending list of actual trading dates for this stock.
      const tradingDates = prices.map((p) => (p.date as Date).toISOString().split('T')[0]).sort()

      // Find the nearest actual trading date on or before publishedAt.
      const snapToTradingDay = (d: Date): string => {
        const iso = d.toISOString().split('T')[0]
        // Binary-search for the last date ≤ iso
        let lo = 0, hi = tradingDates.length - 1, result = tradingDates[0] ?? iso
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          if (tradingDates[mid] <= iso) { result = tradingDates[mid]; lo = mid + 1 }
          else hi = mid - 1
        }
        return result
      }

      const eligibleVideos = videos.filter((v) => {
        const mention = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))
        return mention && mentionQualifies(mention) && mentionExpressesView(mention)
      })

      const markers = await Promise.all(
        eligibleVideos.map(async (v) => {
          const mention = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))!
          const tx = await getVideoTranslation(v , lang)
          const price = mention.priceAtMention
          return {
            videoId: v._id.toString(),
            date: snapToTradingDay(v.publishedAt),
            creatorSlug: v.creator.slug,
            creatorName: v.creator.name,
            creatorColor: v.creator.brandColor,
            creatorInitial: v.creator.initial,
            creatorAvatarUrl: v.creator.avatarUrl,
            sentiment: mention.sentiment ?? 'NEUTRAL',
            note: tx.noteByTicker[mention.ticker] ?? mention.note ?? '',
            title: tx.title,
            url: v.url,
            priceAtMention: price,
            priceLabel: price != null ? `@ $${price.toFixed(2)}` : '',
          }
        }),
      )

      return reply.send(markers)
    },
  )
}

export default stocks
