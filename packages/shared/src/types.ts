import { z } from 'zod'
import { SentimentSchema } from './sentiment.js'

// ── Relevance (how much the creator actually discussed the asset) ────────────
// Ordered from a passing name-drop to the main subject of the video.
export const RelevanceSchema = z.enum(['PASSING', 'MENTIONED', 'DISCUSSED', 'FEATURED'])
export type Relevance = z.infer<typeof RelevanceSchema>

// ── Stance (is the sentiment the creator's own view, or a bare factual recap) ─
// OPINION = forward-looking view / prediction / recommendation / judgment.
// FACTUAL = only reports facts (price moves, earnings, news) with no view.
export const StanceSchema = z.enum(['OPINION', 'FACTUAL'])
export type Stance = z.infer<typeof StanceSchema>

// ── Mention (embedded in Video) ─────────────────────────────────────────────

export const MentionSchema = z.object({
  stockId: z.string(),
  ticker: z.string(),
  sentiment: SentimentSchema,
  confidence: z.number().min(0).max(1).optional(),
  relevance: RelevanceSchema.optional(),
  stance: StanceSchema.optional(),
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
  neutralPct: z.number().optional(),
  bearishPct: z.number().optional(),
  /** Number of view-expressing ratings in the last 7 days that bullishPct is based on. */
  recentRatings: z.number().int().optional(),
  latestClose: z.number().optional(),
  dayChangePct: z.number().optional(),
  change30dPct: z.number().optional(),
  sparkline: z.array(z.number()),
  computedAt: z.date(),
})
export type StockStats = z.infer<typeof StockStatsSchema>

// ── Wall Street analyst consensus (from Yahoo Finance) ──────────────────────

export const AnalystActionSchema = z.object({
  firm: z.string(),
  toGrade: z.string(),
  fromGrade: z.string().optional(),
  /** Yahoo action code: init, up, down, main or reit. */
  action: z.string().optional(),
  priceTarget: z.number().optional(),
  priorPriceTarget: z.number().optional(),
  date: z.date(),
})
export type AnalystAction = z.infer<typeof AnalystActionSchema>

export const StockAnalystSchema = z.object({
  targetMean: z.number().optional(),
  targetHigh: z.number().optional(),
  targetLow: z.number().optional(),
  /** Number of analysts behind the price targets. */
  targetAnalysts: z.number().int().optional(),
  /** Yahoo consensus key: strong_buy, buy, hold, underperform or sell. */
  recommendationKey: z.string().optional(),
  strongBuy: z.number().int(),
  buy: z.number().int(),
  hold: z.number().int(),
  sell: z.number().int(),
  strongSell: z.number().int(),
  /** Each firm's latest action from the last 12 months, newest first. */
  actions: z.array(AnalystActionSchema),
  fetchedAt: z.date(),
})
export type StockAnalyst = z.infer<typeof StockAnalystSchema>

// ── LLM extraction output (validated before writing to DB) ──────────────────

export const LLMExtractionSchema = z.object({
  summary: z.string(),
  mentions: z.array(
    z.object({
      ticker: z.string(),
      sentiment: SentimentSchema,
      confidence: z.number().min(0).max(1).default(1),
      relevance: RelevanceSchema.optional(),
      stance: StanceSchema.optional(),
      isPrimary: z.boolean(),
      note: z.string(),
    }),
  ),
  new_tickers: z.array(
    z.object({
      ticker: z.string(),
      name: z.string(),
    }),
  ).optional().default([]),
})
export type LLMExtraction = z.infer<typeof LLMExtractionSchema>

// ── Transcript statuses ─────────────────────────────────────────────────────

export type TranscriptStatus = 'PENDING' | 'CAPTIONS' | 'TRANSCRIBED' | 'FAILED' | 'SKIPPED'
export type AnalysisStatus = 'PENDING' | 'ANALYZED' | 'FAILED' | 'NO_MENTIONS'
export type TranscriptSource = 'YOUTUBE_CAPTIONS' | 'GEMINI'
