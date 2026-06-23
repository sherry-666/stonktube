import type { FastifyPluginAsync } from 'fastify'
import { Creator, Video } from '@stonktube/db'
import { mentionExpressesView, mentionQualifies } from '@stonktube/shared'

const creators: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/creators', async (_req, reply) => {
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

        const recentCalls = videos.slice(0, 3).map((v) => ({
          videoId: v._id.toString(),
          videoTitle: v.title,
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
  fastify.get<{ Params: { slug: string } }>('/api/creators/:slug', async (req, reply) => {
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
        if (!covers.has(m.ticker)) {
          covers.set(m.ticker, {
            ticker: m.ticker,
            stockId: m.stockId.toString(),
            sentiment: m.sentiment,
          })
        }
        // Only the creator's own views feed bull/neutral/bear counts.
        if (!mentionExpressesView(m)) continue
        if (m.sentiment === 'BULLISH') bullCount++
        else if (m.sentiment === 'NEUTRAL') neutralCount++
        else if (m.sentiment === 'BEARISH') bearCount++
      }
    }

    const total = bullCount + neutralCount + bearCount
    const bullishPct = total > 0 ? Math.round((bullCount / total) * 100) : 0

    const calls = videos.slice(0, 30).map((v) => ({
      videoId: v._id.toString(),
      videoTitle: v.title,
      videoUrl: v.url,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt.toISOString(),
      durationSeconds: v.durationSeconds,
      summary: v.summary ?? '',
      mentions: v.mentions
        .filter((m) => mentionQualifies(m) && mentionExpressesView(m))
        .map((m) => ({
          ticker: m.ticker,
          sentiment: m.sentiment,
          stockId: m.stockId.toString(),
        })),
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
      bullCount,
      neutralCount,
      bearCount,
      covers: Array.from(covers.values()),
      calls,
    })
  })
}

export default creators
