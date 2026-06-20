import type { Relevance } from './types.js'

/** Ordering for relevance levels — higher means more in-depth coverage. */
export const RELEVANCE_RANK: Record<Relevance, number> = {
  PASSING: 0,
  MENTIONED: 1,
  DISCUSSED: 2,
  FEATURED: 3,
}

// Browser-safe env access (this module is re-exported into the web bundle).
const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>

/**
 * Minimum bar for a mention to count toward stats / leaderboards. Tunable via
 * env without a code change. Raise MENTION_MIN_RELEVANCE to 'FEATURED' to only
 * count main-subject coverage, or lower to 'MENTIONED' to be more inclusive.
 */
export const MENTION_MIN_RELEVANCE = (env.MENTION_MIN_RELEVANCE as Relevance) || 'DISCUSSED'
export const MENTION_MIN_CONFIDENCE = Number(env.MENTION_MIN_CONFIDENCE ?? 0.7)

interface QualifiableMention {
  relevance?: Relevance | null
  confidence?: number | null
  isPrimary?: boolean
}

/**
 * Whether a mention reflects real discussion (vs a passing name-drop) and so
 * should count as the stock being "mentioned". Prefers the Gemini relevance
 * signal; mentions analyzed before relevance existed fall back to isPrimary or
 * a confidence floor so existing data still filters sensibly.
 */
export function mentionQualifies(m: QualifiableMention): boolean {
  if (m.relevance != null) {
    return (RELEVANCE_RANK[m.relevance] ?? 0) >= RELEVANCE_RANK[MENTION_MIN_RELEVANCE]
  }
  return Boolean(m.isPrimary) || (m.confidence ?? 0) >= MENTION_MIN_CONFIDENCE
}
