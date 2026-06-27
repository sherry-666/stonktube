interface SentimentBarProps {
  bullishPct: number
  neutralPct: number
  bearishPct: number
}

export default function SentimentBar({ bullishPct, neutralPct, bearishPct }: SentimentBarProps) {
  const total = bullishPct + neutralPct + bearishPct
  const dominant =
    bullishPct >= neutralPct && bullishPct >= bearishPct
      ? { pct: bullishPct, label: 'bullish', color: '#0F9D63' }
      : bearishPct >= neutralPct
        ? { pct: bearishPct, label: 'bearish', color: '#E5484D' }
        : { pct: neutralPct, label: 'neutral', color: '#D9B26A' }

  return (
    <div>
      <div className="flex overflow-hidden" style={{ height: 8, borderRadius: 5 }}>
        {bullishPct > 0 && (
          <div style={{ width: `${bullishPct}%`, background: '#0F9D63', flexShrink: 0 }} />
        )}
        {neutralPct > 0 && (
          <div style={{ width: `${neutralPct}%`, background: '#D9B26A', flexShrink: 0 }} />
        )}
        {bearishPct > 0 && (
          <div style={{ width: `${bearishPct}%`, background: '#E5484D', flexShrink: 0 }} />
        )}
        {total === 0 && (
          <div style={{ width: '100%', background: '#ECEBE4' }} />
        )}
      </div>
      <div className="mt-1 text-[11px] font-medium" style={{ color: dominant.color }}>
        {total > 0 ? `${dominant.pct.toFixed(0)}% ${dominant.label}` : '—'}
      </div>
    </div>
  )
}
