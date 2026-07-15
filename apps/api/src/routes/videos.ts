import type { FastifyPluginAsync } from 'fastify'
import { Video } from '@stonktube/db'
import { mentionExpressesView } from '@stonktube/shared'
import { Types } from 'mongoose'
import { getVideoTranslation } from '../lib/videoTranslation.js'

const videos: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string }; Querystring: { lang?: string } }>('/api/videos/:id', async (req, reply) => {
    const { id } = req.params
    const lang = req.query.lang ?? 'en'

    if (!Types.ObjectId.isValid(id)) {
      return reply.code(404).send({ error: 'Video not found' })
    }

    const video = await Video.findById(id).lean()
    if (!video) return reply.code(404).send({ error: 'Video not found' })

    const primaryMention = video.mentions.find((m) => m.isPrimary)

    const opinionMentions = video.mentions.filter((m) => mentionExpressesView(m))

    const tx = await getVideoTranslation(video , lang)

    const mentions = opinionMentions.map((m) => ({
      ticker: m.ticker,
      stockId: m.stockId.toString(),
      sentiment: m.sentiment,
      note: tx.noteByTicker[m.ticker] ?? m.note,
    }))

    return reply.send({
      id: video._id.toString(),
      title: tx.title,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt.toISOString(),
      durationSeconds: video.durationSeconds,
      summary: tx.summary,
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
