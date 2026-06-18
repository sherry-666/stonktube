import { Queue } from 'bullmq'
import { QUEUES } from '@stonktube/shared'

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

const defaultJobOptions = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 24 * 60 * 60 },
  removeOnFail: false,
}

export const discoverQueue = new Queue(QUEUES.DISCOVER, { connection, defaultJobOptions })
export const transcribeQueue = new Queue(QUEUES.TRANSCRIBE, { connection, defaultJobOptions })
export const analyzeQueue = new Queue(QUEUES.ANALYZE, { connection, defaultJobOptions })
export const pricesQueue = new Queue(QUEUES.PRICES, { connection, defaultJobOptions })
export const rollupQueue = new Queue(QUEUES.ROLLUP, { connection, defaultJobOptions })
