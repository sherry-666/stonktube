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
}

export interface FillPricesJob {
  stockId?: string // if omitted, fills all non-private stocks
}

export interface RebuildStatsJob {
  stockId?: string // if omitted, rebuilds all
}
