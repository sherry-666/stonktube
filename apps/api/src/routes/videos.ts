import type { FastifyPluginAsync } from 'fastify'
import { Video } from '@stonktube/db'
import { mentionExpressesView } from '@stonktube/shared'
import { Types } from 'mongoose'

const videos: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/api/videos/:id', async (req, reply) => {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      return reply.code(404).send({ error: 'Video not found' })
    }

    const video = await Video.findById(id).lean()
    if (!video) return reply.code(404).send({ error: 'Video not found' })

    const primaryMention = video.mentions.find((m) => m.isPrimary)

    // Key takeaways are the creator's sentiment, so only surface mentions that
    // express their own view. Bare factual recaps (price moves, earnings, news,
    // contextual name-drops) carry stance FACTUAL and are filtered out — same
    // gate the stock/creator sentiment stats use (mentionExpressesView).
    const mentions = video.mentions
      .filter((m) => mentionExpressesView(m))
      .map((m) => ({
        ticker: m.ticker,
        stockId: m.stockId.toString(),
        sentiment: m.sentiment,
        note: m.note,
      }))

    return reply.send({
      id: video._id.toString(),
      title: video.title,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt.toISOString(),
      durationSeconds: video.durationSeconds,
      summary: video.summary ?? '',
      creator: {
        slug: video.creator.slug,
        name: video.creator.name,
        handle: video.creator.handle,
        brandColor: video.creator.brandColor,
        initial: video.creator.initial,
        avatarUrl: video.creator.avatarUrl,
      },
      primaryTicker: primaryMention?.ticker ?? '',
      thumbBg: video.creator.brandColor,
      mentions,
    })
  })
}

export default videos
