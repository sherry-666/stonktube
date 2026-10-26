import type { FastifyPluginAsync } from 'fastify'
import { Stock, Video, getPrices } from '@stonktube/db'
import type { ICreatorSnapshot, IMention } from '@stonktube/db'
import { Types } from 'mongoose'
import { resolveSlimVideoTexts } from '../lib/videoTranslation.js'
import { getStockTranslationsBatch, getStockTranslation } from '../lib/stockTranslation.js'
import { stockFields } from '../lib/projections.js'
import { mentionQualifiesExpr, mentionExpressesViewExpr } from '../lib/mentionExprs.js'

function displayTicker(ticker: string): string {
  return ticker.replace(/-USD$/, '')
}

function isKorean(ticker: string): boolean {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ')
}

function currencySymbol(ticker: string): string {
  return isKorean(ticker) ? '₩' : '$'
}

// Static KRW→USD rate for price-sort normalisation only (not displayed).
const KRW_PER_USD = 1400

function toUSDEquivalent(price: number, ticker: string): number {
  return isKorean(ticker) ? price / KRW_PER_USD : price
}

// Company logo by ticker (Financial Modeling Prep). 404s for indices/odd
// symbols, so the client falls back to the initials badge on image error.
function fmpLogo(ticker: string): string {
  return `https://financialmodelingprep.com/image-stock/${displayTicker(ticker)}.png`
}

function fmtPrice(n: number | undefined, ticker: string): string {
  return n != null ? `${currencySymbol(ticker)}${n.toFixed(2)}` : ''
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

interface SlimVideoRow {
  _id: Types.ObjectId
  title: string
  url: string
  publishedAt: Date
  creator: ICreatorSnapshot
  mention: IMention
  cachedTitle?: string
  cachedNotes?: Record<string, string>
}

// Per-video row for one stock: its first mention of the stock plus the cached
// translation for `lang`, instead of the whole video document.
function slimVideoStage(stockId: Types.ObjectId, lang: string) {
  return {
    $project: {
      title: 1,
      url: 1,
      publishedAt: 1,
      creator: 1,
      mention: { $first: { $filter: { input: '$mentions', cond: { $eq: ['$$this.stockId', stockId] } } } },
      cachedTitle: `$translations.${lang}.title`,
      cachedNotes: `$translations.${lang}.notes`,
    },
  }
}

const stocks: FastifyPluginAsync = async (fastify) => {
  // GET /api/stocks?sort=mentions|bull|chg|price|ticker&lang=en|zh|ko
  fastify.get<{ Querystring: { sort?: string; lang?: string } }>('/api/stocks', async (req, reply) => {
    const sort = req.query.sort ?? 'mentions'
    const lang = req.query.lang ?? 'en'
    const all = await Stock.find({}).select(stockFields(lang)).lean()

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
          return {
            v: st?.latestClose != null ? toUSDEquivalent(st.latestClose, s.ticker) : 0,
            has: st?.latestClose != null,
          }
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
      currency: currencySymbol(s.ticker),
      priceStr: fmtPrice(s.stats?.latestClose, s.ticker),
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

      const stock = await Stock.findOne({ ticker }).select(stockFields(lang)).lean()
      if (!stock) return reply.code(404).send({ error: 'Stock not found' })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - tfDays * 1.5) // buffer for weekends

      const stockId = stock._id as Types.ObjectId
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [pricePoints, [counts], coverageVideos] = await Promise.all([
        getPrices(stockId, startDate),
        // trackedBy + overall sentiment, counted in MongoDB over this stock's
        // qualifying mentions so only the totals come back.
        Video.aggregate<{
          trackedBy: { n: number }[]
          sentiment7d: { _id: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; n: number }[]
        }>([
          { $match: { 'mentions.stockId': stockId, analysisStatus: 'ANALYZED' } },
          {
            $project: {
              _id: 0,
              creatorId: 1,
              publishedAt: 1,
              m: { $filter: { input: '$mentions', cond: { $eq: ['$$this.stockId', stockId] } } },
            },
          },
          { $unwind: '$m' },
          { $match: { $expr: mentionQualifiesExpr('$m') } },
          {
            $facet: {
              trackedBy: [{ $group: { _id: '$creatorId' } }, { $count: 'n' }],
              // Overall sentiment: last 7 days, creator's own views only
              // (bare factual recaps excluded).
              sentiment7d: [
                { $match: { publishedAt: { $gte: sevenDaysAgo }, $expr: mentionExpressesViewExpr('$m') } },
                { $group: { _id: '$m.sentiment', n: { $sum: 1 } } },
              ],
            },
          },
        ]),
        // Recent coverage: latest 10 videos whose mention of this stock
        // expresses a view (stance missing or OPINION; skip bare factual
        // recaps), since each row shows the creator's sentiment on it.
        Video.aggregate<SlimVideoRow>([
          {
            $match: {
              mentions: { $elemMatch: { stockId, stance: { $ne: 'FACTUAL' } } },
              analysisStatus: 'ANALYZED',
            },
          },
          { $sort: { publishedAt: -1 } },
          { $limit: 10 },
          slimVideoStage(stockId, lang),
        ]),
      ])

      // Take last tfDays price points
      const priceSeries = pricePoints.slice(-tfDays).map((p) => ({
        date: (p.date as Date).toISOString().split('T')[0],
        close: p.close as number,
      }))

      const countOf = (s: string) => counts.sentiment7d.find((c) => c._id === s)?.n ?? 0
      const bullCount = countOf('BULLISH')
      const neutralCount = countOf('NEUTRAL')
      const bearCount = countOf('BEARISH')

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

      const coverageTexts = await resolveSlimVideoTexts(coverageVideos, lang)
      const recentCoverage = coverageVideos.map((v, i) => {
        const mention = v.mention
        return {
          videoId: v._id.toString(),
          creatorSlug: v.creator.slug,
          creatorName: v.creator.name,
          creatorHandle: v.creator.handle,
          creatorColor: v.creator.brandColor,
          creatorInitial: v.creator.initial,
          creatorAvatarUrl: v.creator.avatarUrl,
          publishedAt: v.publishedAt.toISOString(),
          title: coverageTexts[i].title,
          url: v.url,
          note: coverageTexts[i].note ?? '',
          sentiment: mention.sentiment ?? 'NEUTRAL',
          stance: mention.stance,
          priceAtMention: mention.priceAtMention,
          priceStr: fmtPrice(mention.priceAtMention, stock.ticker),
        }
      })

      const trackedBy = counts.trackedBy[0]?.n ?? 0

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
          currency: currencySymbol(stock.ticker),
          priceStr: fmtPrice(stock.stats?.latestClose, stock.ticker),
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

      const stock = await Stock.findOne({ ticker }).select('ticker').lean()
      if (!stock) return reply.code(404).send({ error: 'Stock not found' })

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - tfDays * 1.5) // buffer for weekends

      const stockId = stock._id as Types.ObjectId
      const [videos, prices] = await Promise.all([
        // Videos in range whose mention of this stock qualifies and expresses
        // a view, as slim rows.
        Video.aggregate<SlimVideoRow>([
          {
            $match: {
              'mentions.stockId': stockId,
              publishedAt: { $gte: startDate },
              analysisStatus: 'ANALYZED',
            },
          },
          { $sort: { publishedAt: -1 } },
          slimVideoStage(stockId, lang),
          {
            $match: {
              $expr: { $and: [mentionQualifiesExpr('$mention'), mentionExpressesViewExpr('$mention')] },
            },
          },
        ]),
        // Load price dates so we can snap each marker to an actual trading day,
        // not just the nearest weekday (holidays can also have no price).
        getPrices(stockId, startDate),
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

      const texts = await resolveSlimVideoTexts(videos, lang)
      const markers = videos.map((v, i) => {
        const mention = v.mention
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
          note: texts[i].note ?? '',
          title: texts[i].title,
          url: v.url,
          priceAtMention: price,
          priceLabel: price != null ? `@ ${currencySymbol(stock.ticker)}${price.toFixed(2)}` : '',
        }
      })

      return reply.send(markers)
    },
  )
}

export default stocks
