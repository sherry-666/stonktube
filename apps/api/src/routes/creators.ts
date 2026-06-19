import type { FastifyPluginAsync } from 'fastify'
import { Creator, Video } from '@stonktube/db'
import { Types } from 'mongoose'

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

        const recentCalls = videos.slice(0, 3).map((v) => {
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
            mentions: v.mentions.map((m) => ({
              ticker: m.ticker,
              sentiment: m.sentiment,
              stockId: m.stockId.toString(),
            })),
          }
        })

        return {
          id: (c._id as Types.ObjectId).toString(),
          slug: c.slug,
          name: c.name,
          handle: c.handle,
          brandColor: c.brandColor,
          initial: c.initial,
          avatarUrl: c.avatarUrl,
          subscriberCount: c.subscriberCount,
          bio: c.bio,
          channelUrl: c.channelUrl,
          videoCount: videos.length,
          bullishPct,
          coveredTickers,
          recentCalls,
        }
      }),
    )

    return reply.send(result)
  })
}

export default creators
