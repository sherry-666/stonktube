import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

interface SentimentIconProps {
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  size?: number
  color?: string
}

const DEFAULTS: Record<string, string> = {
  BULLISH: '#0F9D63',
  NEUTRAL: '#D9B26A',
  BEARISH: '#E5484D',
}

export default function SentimentIcon({ sentiment, size = 14, color }: SentimentIconProps) {
  const c = color ?? DEFAULTS[sentiment]
  if (sentiment === 'BULLISH') return <ThumbsUp size={size} color={c} strokeWidth={2.2} />
  if (sentiment === 'BEARISH') return <ThumbsDown size={size} color={c} strokeWidth={2.2} />
  return <Minus size={size} color={c} strokeWidth={2.5} />
}
