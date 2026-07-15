import type { FastifyPluginAsync } from 'fastify'
import { Creator, Video } from '@stonktube/db'
import { mentionExpressesView, mentionQualifies } from '@stonktube/shared'
import { getVideoTranslation } from '../lib/videoTranslation.js'

const creators: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { lang?: string } }>('/api/creators', async (req, reply) => {
    const lang = req.query.lang ?? 'en'
    const allCreators = await Creator.find({ isActive: true }).lean()

    const result = await Promise.all(
      allCreators.map(async (c) => {
        const videos = await Video.find({
          creatorId: c._id,
          analysisStatus: 'ANALYZED',
        })
          .sort({ publishedAt: -1 })
          .lean()

        let bullCount = 0
        let total = 0
        const tickerSet = new Set<string>()

        for (const v of videos) {
          for (const m of v.mentions) {
            tickerSet.add(m.ticker)
            // Only the creator's own views feed bullishPct, not factual recaps.
            if (!mentionExpressesView(m)) continue
            total++
            if (m.sentiment === 'BULLISH') bullCount++
          }
        }

        const bullishPct = total > 0 ? Math.round((bullCount / total) * 100) : 0
        const coveredTickers = Array.from(tickerSet)

        const recentCalls = await Promise.all(videos.slice(0, 3).map(async (v) => {
          const tx = await getVideoTranslation(v , lang)
          return {
            videoId: v._id.toString(),
            videoTitle: tx.title,
            videoUrl: v.url,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: v.publishedAt.toISOString(),
            durationSeconds: v.durationSeconds,
            mentions: v.mentions
              .filter((m) => mentionExpressesView(m))
              .map((m) => ({
                ticker: m.ticker,
                sentiment: m.sentiment,
                stockId: m.stockId.toString(),
              })),
          }
        }))

        return {
          slug: c.slug,
          name: c.name,
          handle: c.handle,
          brandColor: c.brandColor,
          initial: c.initial,
          avatarUrl: c.avatarUrl,
          subscribers: c.subscriberCount,
          bio: c.bio,
          channelUrl: c.channelUrl,
          videosTracked: videos.length,
          bullishPct,
          coversTickers: coveredTickers,
          recentCalls,
        }
      }),
    )

    return reply.send(result)
  })

  // GET /api/creators/:slug — full profile + every tracked call.
  fastify.get<{ Params: { slug: string }; Querystring: { lang?: string } }>('/api/creators/:slug', async (req, reply) => {
    const lang = req.query.lang ?? 'en'
    const creator = await Creator.findOne({ slug: req.params.slug }).lean()
    if (!creator) return reply.code(404).send({ error: 'Creator not found' })

    const videos = await Video.find({
      creatorId: creator._id,
      analysisStatus: 'ANALYZED',
    })
      .sort({ publishedAt: -1 })
      .lean()

    let bullCount = 0
    let neutralCount = 0
    let bearCount = 0
    // Most-recent qualifying stance per ticker. Videos are sorted newest-first,
    // so the first time we see a ticker is its latest call.
    const covers = new Map<string, { ticker: string; stockId: string; sentiment: string }>()

    for (const v of videos) {
      for (const m of v.mentions) {
        if (!mentionQualifies(m)) continue
        // covers chips and the bull/neutral/bear counts both display sentiment,
        // so only the creator's own views count — skip bare factual recaps.
        if (!mentionExpressesView(m)) continue
        if (!covers.has(m.ticker)) {
          covers.set(m.ticker, {
            ticker: m.ticker,
            stockId: m.stockId.toString(),
            sentiment: m.sentiment,
          })
        }
        if (m.sentiment === 'BULLISH') bullCount++
        else if (m.sentiment === 'NEUTRAL') neutralCount++
        else if (m.sentiment === 'BEARISH') bearCount++
      }
    }

    const total = bullCount + neutralCount + bearCount
    const bullishPct = total > 0 ? Math.round((bullCount / total) * 100) : 0
    const neutralPct = total > 0 ? Math.round((neutralCount / total) * 100) : 0
    const bearishPct = total > 0 ? Math.round((bearCount / total) * 100) : 0

    const calls = await Promise.all(videos.slice(0, 30).map(async (v) => {
      const tx = await getVideoTranslation(v , lang)
      return {
        videoId: v._id.toString(),
        videoTitle: tx.title,
        videoUrl: v.url,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt.toISOString(),
        durationSeconds: v.durationSeconds,
        summary: tx.summary,
        mentions: v.mentions
          .filter((m) => mentionQualifies(m) && mentionExpressesView(m))
          .map((m) => ({
            ticker: m.ticker,
            sentiment: m.sentiment,
            stockId: m.stockId.toString(),
          })),
      }
    }))

    return reply.send({
      slug: creator.slug,
      name: creator.name,
      handle: creator.handle,
      brandColor: creator.brandColor,
      initial: creator.initial,
      avatarUrl: creator.avatarUrl,
      channelUrl: creator.channelUrl,
      bio: creator.bio,
      subscribers: creator.subscriberCount,
      videosTracked: videos.length,
      bullishPct,
      neutralPct,
      bearishPct,
      bullCount,
      neutralCount,
      bearCount,
      covers: Array.from(covers.values()),
      calls,
    })
  })
}

export default creators
