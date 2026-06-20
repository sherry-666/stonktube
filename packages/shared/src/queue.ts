export const QUEUES = {
  DISCOVER: 'discover',
  TRANSCRIBE: 'transcribe',
  ANALYZE: 'analyze',
  PRICES: 'prices',
  ROLLUP: 'rollup',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export interface DiscoverJob {
  creatorId: string
  runId: string
}

export interface TranscribeJob {
  videoId: string
}

export interface AnalyzeJob {
  videoId: string
  /**
   * Re-analyze a video that's already ANALYZED (e.g. backfilling new fields).
   * Skips the "already analyzed" short-circuit and, on failure, preserves the
   * existing analysis instead of marking the video FAILED — so a re-analysis
   * never degrades data that was previously good.
   */
  force?: boolean
}

export interface FillPricesJob {
  stockId?: string // if omitted, fills all non-private stocks
}

export interface RebuildStatsJob {
  stockId?: string // if omitted, rebuilds all
}
