import type { FastifyPluginAsync } from 'fastify'
import { Stock, Creator } from '@stonktube/db'

const search: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { q?: string } }>('/api/search', async (req, reply) => {
    const q = (req.query.q ?? '').trim()
    if (!q) return reply.send({ stocks: [], creators: [] })

    const regex = new RegExp(q, 'i')

    const [stockDocs, creatorDocs] = await Promise.all([
      Stock.find({ $or: [{ ticker: regex }, { name: regex }] })
        .select('ticker name brandColor initials')
        .lean(),
      Creator.find({
        isActive: true,
        $or: [{ name: regex }, { handle: regex }],
      })
        .select('slug name handle brandColor initial')
        .lean(),
    ])

    return reply.send({
      stocks: stockDocs.map((s) => ({
        ticker: s.ticker,
        name: s.name,
        brandColor: s.brandColor,
        initials: s.initials,
      })),
      creators: creatorDocs.map((c) => ({
        slug: c.slug,
        name: c.name,
        handle: c.handle,
        brandColor: c.brandColor,
        initial: c.initial,
      })),
    })
  })
}

export default search
