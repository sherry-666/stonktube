interface SentimentBarProps {
  bullCount: number
  neutralCount: number
  bearCount: number
}

export default function SentimentBar({ bullCount, neutralCount, bearCount }: SentimentBarProps) {
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
      {(() => {
        const dominant =
          bullPct >= neutralPct && bullPct >= bearPct
            ? { pct: bullPct, label: 'bullish', color: '#0F9D63' }
            : bearPct >= neutralPct
              ? { pct: bearPct, label: 'bearish', color: '#E5484D' }
              : { pct: neutralPct, label: 'neutral', color: '#D9B26A' }
        return (
          <div className="mt-1 text-[11px] font-medium" style={{ color: dominant.color }}>
            {total > 0 ? `${dominant.pct.toFixed(0)}% ${dominant.label}` : '—'}
          </div>
        )
      })()}
    </div>
  )
}
