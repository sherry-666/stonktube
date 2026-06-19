import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })
import Fastify from 'fastify'
import { connectDB } from '@stonktube/db'
import { ensureIndexes } from '@stonktube/db'
import dashboard from './routes/dashboard.js'
import stocks from './routes/stocks.js'
import creators from './routes/creators.js'
import videos from './routes/videos.js'
import search from './routes/search.js'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

// Simple CORS for dev
app.addHook('onRequest', async (req, reply) => {
  void req
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type')
})

app.options('*', async (_req, reply) => {
  return reply.code(204).send()
})

app.get('/healthz', async () => ({ status: 'ok' }))

app.register(dashboard)
app.register(stocks)
app.register(creators)
app.register(videos)
app.register(search)

// Serve SPA in production
if (process.env.NODE_ENV === 'production') {
  const staticPlugin = await import('@fastify/static')
  const { fileURLToPath } = await import('url')
  const { join, dirname } = await import('path')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const distPath = join(__dirname, '../../../apps/web/dist')
  await app.register(staticPlugin.default, {
    root: distPath,
    prefix: '/',
  })
}

const start = async () => {
  await connectDB()
  await ensureIndexes()
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`API listening on port ${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
