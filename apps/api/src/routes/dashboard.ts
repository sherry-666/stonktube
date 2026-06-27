import type { FastifyPluginAsync } from 'fastify'
import { Stock, Video } from '@stonktube/db'
import { mentionExpressesView } from '@stonktube/shared'

// Strip Yahoo Finance suffix for crypto tickers (BTC-USD → BTC)
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

const dashboard: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/dashboard', async (_req, reply) => {
    const [stocks, videos] = await Promise.all([
      Stock.find({}).lean(),
      Video.find({ analysisStatus: 'ANALYZED' })
        .sort({ publishedAt: -1 })
        .limit(8)
        .lean(),
    ])

    // Pills: top 8 by recent mentions
    const pills = stocks
      .sort((a, b) => (b.stats?.mentions30d ?? 0) - (a.stats?.mentions30d ?? 0))
      .slice(0, 8)
      .map((s) => ({
        ticker: displayTicker(s.ticker),
        name: s.name,
        isPrivate: s.isPrivate,
        brandColor: s.brandColor,
        logoBg: s.logoBg,
        initials: s.initials,
        priceStr: fmtPrice(s.stats?.latestClose),
        dayChangePct: s.stats?.dayChangePct ?? 0,
        dayChangeStr: fmtPct(s.stats?.dayChangePct),
        bullishPct: s.stats?.bullishPct ?? 0,
        neutralPct: (() => {
          const t = (s.stats?.bullCount ?? 0) + (s.stats?.neutralCount ?? 0) + (s.stats?.bearCount ?? 0)
          return t > 0 ? Math.round(((s.stats?.neutralCount ?? 0) / t) * 100) : 0
        })(),
        bearishPct: (() => {
          const t = (s.stats?.bullCount ?? 0) + (s.stats?.neutralCount ?? 0) + (s.stats?.bearCount ?? 0)
          return t > 0 ? Math.round(((s.stats?.bearCount ?? 0) / t) * 100) : 0
        })(),
        recentRatings: s.stats?.recentRatings ?? 0,
        sparkline: s.stats?.sparkline ?? [],
      }))

    // Feed: latest 8 analyzed videos as VideoCardDTO
    const feed = videos.map((v) => {
      const primaryMention = v.mentions.find((m) => m.isPrimary)
      return {
        id: v._id.toString(),
        title: v.title,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt.toISOString(),
        durationSeconds: v.durationSeconds,
        creator: {
          slug: v.creator.slug,
          name: v.creator.name,
          handle: v.creator.handle,
          brandColor: v.creator.brandColor,
          initial: v.creator.initial,
          avatarUrl: v.creator.avatarUrl,
        },
        primaryTicker: primaryMention?.ticker ?? '',
        thumbBg: v.creator.brandColor,
        // Sentiment-colored chips reflect the creator's view, so drop bare
        // factual recaps (stance FACTUAL) — same gate as the sentiment stats.
        mentions: v.mentions
          .filter((m) => mentionExpressesView(m))
          .map((m) => ({
            ticker: m.ticker,
            sentiment: m.sentiment,
            stockId: m.stockId.toString(),
          })),
      }
    })

    // mostMentioned: top 6 by mentions30d
    const sortedByMentions = [...stocks].sort(
      (a, b) => (b.stats?.mentions30d ?? 0) - (a.stats?.mentions30d ?? 0),
    )
    const top6Mentions = sortedByMentions.slice(0, 6)
    const maxMentions = top6Mentions[0]?.stats?.mentions30d ?? 1
    const mostMentioned = top6Mentions.map((s) => ({
      ticker: s.ticker,
      brandColor: s.brandColor,
      mentions30d: s.stats?.mentions30d ?? 0,
      maxMentions,
    }))

    // mostBullish: top 6 by bullishPct, among stocks with recent ratings only
    const sortedByBull = [...stocks]
      .filter((s) => (s.stats?.recentRatings ?? 0) > 0)
      .sort((a, b) => (b.stats?.bullishPct ?? 0) - (a.stats?.bullishPct ?? 0))
    const mostBullish = sortedByBull.slice(0, 6).map((s) => ({
      ticker: s.ticker,
      bullishPct: s.stats?.bullishPct ?? 0,
      verdict: verdict(s.stats?.bullishPct ?? 0),
    }))

    return reply.send({ pills, feed, mostMentioned, mostBullish })
  })
}

export default dashboard
