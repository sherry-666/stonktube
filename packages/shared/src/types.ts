import { z } from 'zod'
import { SentimentSchema } from './sentiment.js'

// ── Mention (embedded in Video) ─────────────────────────────────────────────

export const MentionSchema = z.object({
  stockId: z.string(),
  ticker: z.string(),
  sentiment: SentimentSchema,
  confidence: z.number().min(0).max(1).optional(),
  note: z.string(),
  isPrimary: z.boolean(),
  priceAtMention: z.number().optional(),
})
export type Mention = z.infer<typeof MentionSchema>

// ── Stock stats (embedded rollup on Stock doc) ───────────────────────────────

export const StockStatsSchema = z.object({
  mentions30d: z.number().int(),
  distinctCreators: z.number().int(),
  bullCount: z.number().int(),
  neutralCount: z.number().int(),
  bearCount: z.number().int(),
  bullishPct: z.number(),
  latestClose: z.number().optional(),
  dayChangePct: z.number().optional(),
  change30dPct: z.number().optional(),
  sparkline: z.array(z.number()),
  computedAt: z.date(),
})
export type StockStats = z.infer<typeof StockStatsSchema>

// ── LLM extraction output (validated before writing to DB) ──────────────────

export const LLMExtractionSchema = z.object({
  summary: z.string(),
  mentions: z.array(
    z.object({
      ticker: z.string(),
      sentiment: SentimentSchema,
      confidence: z.number().min(0).max(1).default(1),
      isPrimary: z.boolean(),
      note: z.string(),
    }),
  ),
})
export type LLMExtraction = z.infer<typeof LLMExtractionSchema>

// ── Transcript statuses ─────────────────────────────────────────────────────

export type TranscriptStatus = 'PENDING' | 'CAPTIONS' | 'TRANSCRIBED' | 'FAILED' | 'SKIPPED'
export type AnalysisStatus = 'PENDING' | 'ANALYZED' | 'FAILED' | 'NO_MENTIONS'
export type TranscriptSource = 'YOUTUBE_CAPTIONS' | 'WHISPER'
