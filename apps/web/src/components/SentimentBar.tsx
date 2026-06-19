interface SentimentBarProps {
  bullCount: number
  neutralCount: number
  bearCount: number
  bullishPct: number
}

export default function SentimentBar({ bullCount, neutralCount, bearCount, bullishPct }: SentimentBarProps) {
  const total = bullCount + neutralCount + bearCount
  const bullPct = total > 0 ? (bullCount / total) * 100 : 0
  const neutralPct = total > 0 ? (neutralCount / total) * 100 : 0
  const bearPct = total > 0 ? (bearCount / total) * 100 : 0

  return (
    <div>
      <div
        className="flex overflow-hidden"
        style={{ height: 8, borderRadius: 5 }}
      >
        {bullPct > 0 && (
          <div style={{ width: `${bullPct}%`, background: '#0F9D63', flexShrink: 0 }} />
        )}
        {neutralPct > 0 && (
          <div style={{ width: `${neutralPct}%`, background: '#D9B26A', flexShrink: 0 }} />
        )}
        {bearPct > 0 && (
          <div style={{ width: `${bearPct}%`, background: '#E5484D', flexShrink: 0 }} />
        )}
        {total === 0 && (
          <div style={{ width: '100%', background: '#ECEBE4' }} />
        )}
      </div>
      <div className="mt-1 text-[11px] font-medium" style={{ color: '#0F9D63' }}>
        {bullishPct.toFixed(0)}% bullish
      </div>
    </div>
  )
}
