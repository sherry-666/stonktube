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

  // Analyze is rate-limited against Gemini's TPM quota by a token bucket in the
  // handler, plus BullMQ's native rateLimit() on a 429 — which needs the worker
  // handle, so we pass it into the processor. Concurrency 1 keeps pacing exact.
  const analyzeWorker: Worker = new Worker(
    QUEUES.ANALYZE,
    job => handleAnalyze(job, analyzeWorker),
    {
      connection,
      concurrency: 1,
      settings: {
        // Exponential backoff (30s, 60s, 120s, 240s, capped at 5m) with up to
        // +30% random jitter, so 429'd jobs don't retry in lockstep and stampede
        // the quota. Used for the 'custom' backoff on analyze jobs. (A 429 that
        // carries a Retry-After is handled separately via worker.rateLimit.)
        backoffStrategy: (attemptsMade: number) => {
          const base = 30_000 * 2 ** Math.max(0, attemptsMade - 1)
          const capped = Math.min(base, 5 * 60_000)
          return Math.round(capped + Math.random() * capped * 0.3)
        },
      },
    },
  )

  const workers = [
    new Worker(QUEUES.DISCOVER, handleDiscover, { connection, concurrency: 2 }),
    new Worker(QUEUES.TRANSCRIBE, handleTranscribe, { connection, concurrency: 2 }),
    analyzeWorker,
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
