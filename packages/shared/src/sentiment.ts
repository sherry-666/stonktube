import { z } from 'zod'

export const SentimentSchema = z.enum(['BULLISH', 'NEUTRAL', 'BEARISH'])
export type Sentiment = z.infer<typeof SentimentSchema>

export const SENTIMENT_META = {
  BULLISH: { color: '#0F9D63', bg: '#E7F6EE', label: 'Bullish', icon: 'thumbs-up' },
  NEUTRAL: { color: '#D9B26A', bg: '#FBF3E2', label: 'Neutral', icon: 'minus' },
  BEARISH: { color: '#E5484D', bg: '#FCEBEC', label: 'Bearish', icon: 'thumbs-down' },
} as const

export type Verdict = 'Strong buy' | 'Buy' | 'Mixed' | 'Cautious' | 'Bearish'

export function bullishPctToVerdict(pct: number): Verdict {
  if (pct >= 80) return 'Strong buy'
  if (pct >= 60) return 'Buy'
  if (pct >= 40) return 'Mixed'
  if (pct >= 20) return 'Cautious'
  return 'Bearish'
}
