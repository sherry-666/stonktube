import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
// dist/index.js → ../../.. = monorepo root
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })
import { Worker } from 'bullmq'
import { connectDB } from '@stonktube/db'
import { QUEUES } from '@stonktube/shared'
import pino from 'pino'

import { handleDiscover } from './handlers/discover.js'
import { handleTranscribe } from './handlers/transcribe.js'
import { handleAnalyze } from './handlers/analyze.js'
import { handleFillPrices } from './handlers/prices.js'
import { handleRollup } from './handlers/rollup.js'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

async function start() {
  await connectDB()
  log.info('Worker connected to DB')

  const workers = [
    new Worker(QUEUES.DISCOVER, handleDiscover, { connection, concurrency: 2 }),
    new Worker(QUEUES.TRANSCRIBE, handleTranscribe, { connection, concurrency: 2 }),
    // Concurrency 1 + an in-handler minimum-interval throttle (see analyze.ts)
    // keep Gemini calls under its tokens/min quota. BullMQ's Worker `limiter`
    // was unreliable here (it didn't cap fast-failing 429s), so the rate cap
    // lives in the handler instead.
    new Worker(QUEUES.ANALYZE, handleAnalyze, { connection, concurrency: 1 }),
    new Worker(QUEUES.PRICES, handleFillPrices, { connection, concurrency: 5 }),
    new Worker(QUEUES.ROLLUP, handleRollup, { connection, concurrency: 1 }),
  ]

  for (const w of workers) {
    w.on('failed', (job, err) =>
      log.error({ jobId: job?.id, queue: job?.queueName, err: err.message }, 'Job failed'),
    )
    w.on('completed', job =>
      log.info({ jobId: job.id, queue: job.queueName }, 'Job completed'),
    )
  }

  log.info('Worker started — listening on all queues')

  const shutdown = async () => {
    log.info('Shutting down workers…')
    await Promise.all(workers.map(w => w.close()))
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
