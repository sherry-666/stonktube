import type { FastifyPluginAsync } from 'fastify'
import { Stock, Creator } from '@stonktube/db'

const SITE_URL = 'https://stonktube.app'

const sitemap: FastifyPluginAsync = async (fastify) => {
  fastify.get('/sitemap.xml', async (_req, reply) => {
    const [tickers, slugs] = await Promise.all([
      Stock.find({}, { ticker: 1, _id: 0 }).lean(),
      Creator.find({}, { slug: 1, _id: 0 }).lean(),
    ])

    const locs = [
      SITE_URL,
      `${SITE_URL}/stocks`,
      `${SITE_URL}/creators`,
      ...tickers.map(s => `${SITE_URL}/stocks/${encodeURIComponent(s.ticker)}`),
      ...slugs.map(c => `${SITE_URL}/creators/${encodeURIComponent(c.slug)}`),
    ]

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...locs.map(loc => `  <url><loc>${loc}</loc></url>`),
      '</urlset>',
    ].join('\n')

    return reply.type('application/xml').send(xml)
  })
}

export default sitemap
