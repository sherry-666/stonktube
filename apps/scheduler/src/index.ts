/**
 * Railway cron service. Connects to Redis + DB, enqueues due jobs, exits.
 * Deterministic jobIds make overlapping ticks safe (BullMQ deduplicates).
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })
import { connectDB, disconnectDB, Creator, Stock } from '@stonktube/db'
import { discoverQueue, pricesQueue, rollupQueue } from '@stonktube/pipeline'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function run() {
  const runId = new Date().toISOString()
  log.info({ runId }, 'Scheduler tick')

  await connectDB()

  // One discover job per active creator
  const creators = await Creator.find({ isActive: true }, '_id name')
  // Job IDs use - not : because BullMQ uses : as a Redis key separator
  const hour = runId.slice(0, 13).replace(/:/g, '-')

  for (const c of creators) {
    await discoverQueue.add(
      'discover',
      { creatorId: c._id.toString(), runId },
      { jobId: `discover-${c._id}-${hour}` },
    )
  }
  log.info({ count: creators.length }, 'Discovery jobs enqueued')

  await pricesQueue.add(
    'fillPrices',
    { stockId: undefined },
    { jobId: `prices-all-${hour}` },
  )
  log.info('Price fill job enqueued')

  await rollupQueue.add(
    'rollup',
    {},
    { jobId: `rollup-all-${hour}` },
  )
  log.info('Rollup job enqueued')

  await disconnectDB()
  log.info('Scheduler done — exiting')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
