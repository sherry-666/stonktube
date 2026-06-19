import type { FastifyPluginAsync } from 'fastify'
import { Video, Stock } from '@stonktube/db'
import { Types } from 'mongoose'

// Map ticker → display name (fallback to DB name)
const TICKER_NAMES: Record<string, string> = {
  NVDA: 'NVIDIA',
  GOOGL: 'Alphabet',
  COIN: 'Coinbase',
  SPACEX: 'SpaceX',
  TSLA: 'Tesla',
  MSTR: 'Strategy',
}

const videos: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>('/api/videos/:id', async (req, reply) => {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      return reply.code(404).send({ error: 'Video not found' })
    }

    const video = await Video.findById(id).lean()
    if (!video) return reply.code(404).send({ error: 'Video not found' })

    // Build stock name map from DB for any unknown tickers
    const tickers = video.mentions.map((m) => m.ticker)
    const stockDocs = await Stock.find({ ticker: { $in: tickers } })
      .select('ticker name')
      .lean()
    const stockNameMap: Record<string, string> = {}
    for (const s of stockDocs) {
      stockNameMap[s.ticker] = TICKER_NAMES[s.ticker] ?? s.name
    }

    const primaryMention = video.mentions.find((m) => m.isPrimary)

    const takeaways = video.mentions.map((m) => ({
      ticker: m.ticker,
      name: stockNameMap[m.ticker] ?? m.ticker,
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
      takeaways,
    })
  })
}

export default videos
