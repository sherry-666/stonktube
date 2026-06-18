/**
 * Railway cron service. Connects to Redis, enqueues due jobs, exits.
 * Stateless — deterministic jobIds make overlapping ticks safe.
 */
import pino from 'pino'
import { discoverQueue, pricesQueue, rollupQueue } from '@stonktube/pipeline'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function run() {
  const runId = new Date().toISOString()
  log.info({ runId }, 'Scheduler tick')

  // TODO Phase 4: query active creator IDs from DB
  // For now, enqueue a placeholder discover job
  await discoverQueue.add(
    'discoverAll',
    { creatorId: 'all', runId },
    { jobId: `discover:all:${runId}` },
  )

  await pricesQueue.add(
    'fillAllPrices',
    { stockId: undefined },
    { jobId: `prices:all:${runId}` },
  )

  await rollupQueue.add(
    'rebuildAllStats',
    {},
    { jobId: `rollup:all:${runId}` },
  )

  log.info('Jobs enqueued — exiting')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
