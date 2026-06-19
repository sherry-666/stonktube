import type { Job } from 'bullmq'
import { rebuildStats } from '@stonktube/db'
import type { RebuildStatsJob } from '@stonktube/shared'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

export async function handleRollup(job: Job<RebuildStatsJob>) {
  const { stockId } = job.data
  log.info({ stockId: stockId ?? 'all' }, 'Running rollup')
  await rebuildStats(stockId)
  log.info({ stockId: stockId ?? 'all' }, 'Rollup complete')
}
