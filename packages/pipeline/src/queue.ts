import { Queue } from 'bullmq'
import { QUEUES } from '@stonktube/shared'

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }

const defaultJobOptions = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 24 * 60 * 60 },
  removeOnFail: false,
}

// Analyze calls Gemini, which rate-limits on tokens/min. Use a longer backoff so
// retries land in a later quota window (a 429 typically asks to retry in ~30s)
// rather than burning all attempts inside the same exceeded minute. Throughput
// itself is capped by the worker's limiter (see apps/worker/src/index.ts).
const analyzeJobOptions = {
  ...defaultJobOptions,
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 30000 },
}

export const discoverQueue = new Queue(QUEUES.DISCOVER, { connection, defaultJobOptions })
export const transcribeQueue = new Queue(QUEUES.TRANSCRIBE, { connection, defaultJobOptions })
export const analyzeQueue = new Queue(QUEUES.ANALYZE, { connection, defaultJobOptions: analyzeJobOptions })
export const pricesQueue = new Queue(QUEUES.PRICES, { connection, defaultJobOptions })
export const rollupQueue = new Queue(QUEUES.ROLLUP, { connection, defaultJobOptions })
