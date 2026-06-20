import type { FastifyPluginAsync } from 'fastify'
import { Stock, Video, getPrices } from '@stonktube/db'
import { Types } from 'mongoose'

function displayTicker(ticker: string): string {
  return ticker.replace(/-USD$/, '')
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
  // GET /api/stocks?sort=mentions|bull|chg|price|ticker
  fastify.get<{ Querystring: { sort?: string } }>('/api/stocks', async (req, reply) => {
    const sort = req.query.sort ?? 'mentions'
    const all = await Stock.find({}).lean()

    const sorted = [...all].sort((a, b) => {
      switch (sort) {
        case 'bull':
          return (b.stats?.bullishPct ?? 0) - (a.stats?.bullishPct ?? 0)
        case 'chg':
          return (b.stats?.change30dPct ?? 0) - (a.stats?.change30dPct ?? 0)
        case 'price':
          return (b.stats?.latestClose ?? 0) - (a.stats?.latestClose ?? 0)
        case 'ticker':
          return a.ticker.localeCompare(b.ticker)
        case 'mentions':
        default:
          return (b.stats?.mentions30d ?? 0) - (a.stats?.mentions30d ?? 0)
      }
    })

    const rows = sorted.map((s) => ({
      ticker: displayTicker(s.ticker),
      name: s.name,
      sector: s.sector,
      isPrivate: s.isPrivate,
      brandColor: s.brandColor,
      logoBg: s.logoBg,
      initials: s.initials,
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
      },
      mentions30d: s.stats?.mentions30d ?? 0,
      distinctCreators: s.stats?.distinctCreators ?? 0,
    }))

    return reply.send(rows)
  })

  // GET /api/stocks/:ticker?tf=1M|3M|6M|1Y
  fastify.get<{ Params: { ticker: string }; Querystring: { tf?: string } }>(
    '/api/stocks/:ticker',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase()
      const tf = req.query.tf ?? '3M'
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
          if (mention.sentiment === 'BULLISH') bullCount++
          else if (mention.sentiment === 'NEUTRAL') neutralCount++
          else if (mention.sentiment === 'BEARISH') bearCount++
        }
      }

      const total = bullCount + neutralCount + bearCount
      const bullishPct = total > 0 ? Math.round((bullCount / total) * 100) : 0

      const overallSentiment = {
        total,
        bullCount,
        neutralCount,
        bearCount,
        bullishPct,
        verdict: verdict(bullishPct),
      }

      // Recent coverage: all videos sorted by publishedAt desc, limit 10
      const recentCoverage = videos.slice(0, 10).map((v) => {
        const mention = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))
        return {
          videoId: v._id.toString(),
          creatorName: v.creator.name,
          creatorHandle: v.creator.handle,
          creatorColor: v.creator.brandColor,
          creatorInitial: v.creator.initial,
          creatorAvatarUrl: v.creator.avatarUrl,
          publishedAt: v.publishedAt.toISOString(),
          title: v.title,
          url: v.url,
          sentiment: mention?.sentiment ?? 'NEUTRAL',
          priceAtMention: mention?.priceAtMention,
          priceStr: fmtPrice(mention?.priceAtMention),
        }
      })

      const trackedBy = new Set(videos.map((v) => v.creatorId.toString())).size

      return reply.send({
        stock: {
          ticker: displayTicker(stock.ticker),
          name: stock.name,
          sector: stock.sector,
          isPrivate: stock.isPrivate,
          brandColor: stock.brandColor,
          logoBg: stock.logoBg,
          initials: stock.initials,
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

  // GET /api/stocks/:ticker/markers?tf=
  fastify.get<{ Params: { ticker: string }; Querystring: { tf?: string } }>(
    '/api/stocks/:ticker/markers',
    async (req, reply) => {
      const ticker = req.params.ticker.toUpperCase()
      const tf = req.query.tf ?? '3M'
      const tfDays = TF_DAYS[tf] ?? TF_DAYS['3M']

      const stock = await Stock.findOne({ ticker }).lean()
      if (!stock) return reply.code(404).send({ error: 'Stock not found' })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - tfDays * 1.5) // buffer for weekends

      const videos = await Video.find({
        'mentions.stockId': stock._id,
        publishedAt: { $gte: startDate },
        analysisStatus: 'ANALYZED',
      })
        .sort({ publishedAt: -1 })
        .lean()

      const markers = videos.map((v) => {
        const mention = v.mentions.find((m) => m.stockId.equals(stock._id as Types.ObjectId))
        const price = mention?.priceAtMention
        return {
          videoId: v._id.toString(),
          date: v.publishedAt.toISOString().split('T')[0],
          creatorSlug: v.creator.slug,
          creatorName: v.creator.name,
          creatorColor: v.creator.brandColor,
          creatorInitial: v.creator.initial,
          creatorAvatarUrl: v.creator.avatarUrl,
          sentiment: mention?.sentiment ?? 'NEUTRAL',
          note: mention?.note ?? '',
          title: v.title,
          url: v.url,
          priceAtMention: price,
          priceLabel: price != null ? `@ $${price.toFixed(2)}` : '',
        }
      })

      return reply.send(markers)
    },
  )
}

export default stocks
