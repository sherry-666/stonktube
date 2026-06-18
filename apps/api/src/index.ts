import Fastify from 'fastify'
import { connectDB } from '@stonktube/db'
import { ensureIndexes } from '@stonktube/db'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

app.get('/healthz', async () => ({ status: 'ok' }))

// TODO Phase 2: register route plugins
// app.register(import('./routes/dashboard.js'))
// app.register(import('./routes/stocks.js'))
// app.register(import('./routes/creators.js'))
// app.register(import('./routes/videos.js'))
// app.register(import('./routes/search.js'))

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
