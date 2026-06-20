import type { FastifyPluginAsync } from 'fastify'
import { Creator, Video } from '@stonktube/db'

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
            total++
            if (m.sentiment === 'BULLISH') bullCount++
            tickerSet.add(m.ticker)
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
          mentions: v.mentions.map((m) => ({
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
}

export default creators
