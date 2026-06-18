import { Worker } from 'bullmq'
import { connectDB } from '@stonktube/db'
import { QUEUES } from '@stonktube/shared'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

async function start() {
  await connectDB()
  log.info('Worker connected to DB')

  // TODO Phase 3: import real handlers
  // import { handleDiscover } from './handlers/discover.js'
  // import { handleTranscribe } from './handlers/transcribe.js'
  // import { handleAnalyze } from './handlers/analyze.js'
  // import { handleFillPrices } from './handlers/prices.js'
  // import { handleRebuildStats } from './handlers/rollup.js'

  const workers = [
    new Worker(QUEUES.DISCOVER, async (job) => { log.info({ job: job.name }, 'discover stub') }, { connection, concurrency: 2 }),
    new Worker(QUEUES.TRANSCRIBE, async (job) => { log.info({ job: job.name }, 'transcribe stub') }, { connection, concurrency: 2 }),
    new Worker(QUEUES.ANALYZE, async (job) => { log.info({ job: job.name }, 'analyze stub') }, { connection, concurrency: 3 }),
    new Worker(QUEUES.PRICES, async (job) => { log.info({ job: job.name }, 'prices stub') }, { connection, concurrency: 5 }),
    new Worker(QUEUES.ROLLUP, async (job) => { log.info({ job: job.name }, 'rollup stub') }, { connection, concurrency: 1 }),
  ]

  for (const w of workers) {
    w.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'Job failed'))
  }

  log.info('Worker started — listening on all queues')
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
