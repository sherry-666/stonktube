import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStocks } from '../api/hooks.js'
import Sparkline from '../components/Sparkline.js'
import SentimentBar from '../components/SentimentBar.js'
import { fmtPrice, fmtPct } from '../utils/format.js'

const SORT_PILLS = [
  { label: 'Most mentioned', value: 'mentions' },
  { label: 'Most bullish', value: 'bull' },
  { label: 'Top movers', value: 'chg' },
  { label: 'Price', value: 'price' },
  { label: 'A–Z', value: 'ticker' },
]

const COL_GRID_DESKTOP = '2.2fr 1.1fr 0.9fr 1.4fr 0.9fr 0.9fr'
const COL_GRID_MOBILE = '1fr 1fr 0.8fr'

export default function Stocks() {
  const navigate = useNavigate()
  const [sort, setSort] = useState('mentions')
  const { data, isLoading, error } = useStocks(sort)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(700)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width))
    ro.observe(el)
    setContainerW(el.offsetWidth)
    return () => ro.disconnect()
  }, [])
  const isMobile = containerW < 560
  const COL_GRID = isMobile ? COL_GRID_MOBILE : COL_GRID_DESKTOP

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p
          className="mb-1"
          style={{
            color: '#4F46E5',
            fontSize: 13,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          All tracked names
        </p>
        <h1
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: 42,
            letterSpacing: '-0.03em',
            color: '#14151A',
            lineHeight: 1.05,
          }}
        >
          Stocks
        </h1>
      </div>

      {/* Sort control */}
      <div className="flex items-center gap-3">
        {!isMobile && <span className="text-[13px] font-medium text-muted shrink-0">Sort by</span>}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {SORT_PILLS.map(p => (
            <button
              key={p.value}
              onClick={() => setSort(p.value)}
              className="px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 shrink-0"
              style={{
                borderRadius: 8,
                background: sort === p.value ? '#14151A' : 'white',
                color: sort === p.value ? 'white' : '#6E6F78',
                border: sort === p.value ? '1px solid transparent' : '1px solid #ECEBE4',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white" style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #ECEBE4' }}>
        {/* Header row */}
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: COL_GRID,
            gap: isMobile ? 8 : 16,
            padding: isMobile ? '10px 14px' : '12px 22px',
            borderBottom: '1px solid #F3F2EC',
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Stock</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint text-right">Price</span>
          {!isMobile && <span className="text-[11px] font-semibold uppercase tracking-wider text-faint text-right">30D</span>}
          {!isMobile && <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Sentiment</span>}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint text-right">Mentions</span>
          {!isMobile && <span className="text-[11px] font-semibold uppercase tracking-wider text-faint text-right">Creators</span>}
        </div>

        {isLoading && (
          <div className="py-10 text-center text-muted text-sm">Loading…</div>
        )}
        {error && (
          <div className="py-10 text-center text-bear text-sm">Failed to load stocks.</div>
        )}

        {data?.map((stock, idx) => {
          const isUp = stock.dayChangePct >= 0
          const change30Up = stock.change30dPct >= 0

          return (
            <button
              key={stock.ticker}
              onClick={() => navigate(`/stocks/${stock.ticker}`)}
              className="grid items-center w-full text-left transition-colors duration-150"
              style={{
                gridTemplateColumns: COL_GRID,
                gap: isMobile ? 8 : 16,
                padding: isMobile ? '12px 14px' : '16px 22px',
                borderBottom: idx < (data?.length ?? 0) - 1 ? '1px solid #F3F2EC' : 'none',
                background: 'white',
                cursor: 'pointer',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#FAFAF7')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'white')}
            >
              {/* Col 1: Stock */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: isMobile ? 32 : 40,
                    height: isMobile ? 32 : 40,
                    borderRadius: isMobile ? 9 : 11,
                    background: stock.logoBg || '#F0EFE8',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 700,
                      fontSize: isMobile ? 11 : 13,
                      color: stock.brandColor || '#14151A',
                    }}
                  >
                    {stock.initials}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight: 600,
                        fontSize: isMobile ? 13 : 15,
                        color: '#14151A',
                      }}
                    >
                      {stock.ticker}
                    </span>
                    {stock.isPrivate && (
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded"
                        style={{ background: '#FBF3E2', color: '#8A6D3B' }}
                      >
                        Priv
                      </span>
                    )}
                  </div>
                  {!isMobile && (
                    <div className="text-[12.5px] truncate" style={{ color: '#9A9BA4', marginTop: 1 }}>
                      {stock.name} · {stock.sector}
                    </div>
                  )}
                  {isMobile && (
                    <div className="text-[11px] truncate" style={{ color: '#9A9BA4', marginTop: 1 }}>
                      {stock.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Col 2: Price */}
              <div className="flex flex-col items-end gap-1">
                {!isMobile && <Sparkline points={stock.sparkline} width={60} height={26} color={isUp ? '#0F9D63' : '#E5484D'} />}
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600,
                    fontSize: isMobile ? 12 : 14,
                    color: '#14151A',
                  }}
                >
                  {stock.isPrivate ? '—' : stock.priceStr}
                </span>
                {isMobile && (
                  <span className="text-[11px] font-semibold" style={{ color: change30Up ? '#0F9D63' : '#E5484D' }}>
                    {stock.isPrivate ? '' : fmtPct(stock.change30dPct)}
                  </span>
                )}
              </div>

              {/* Col 3: 30D (desktop only) */}
              {!isMobile && (
                <div className="text-right">
                  <span className="text-[13px] font-semibold" style={{ color: change30Up ? '#0F9D63' : '#E5484D' }}>
                    {fmtPct(stock.change30dPct)}
                  </span>
                </div>
              )}

              {/* Col 4: Sentiment (desktop only) */}
              {!isMobile && (
                <div>
                  <SentimentBar
                    bullCount={stock.sentiment.bullCount}
                    neutralCount={stock.sentiment.neutralCount}
                    bearCount={stock.sentiment.bearCount}
                    bullishPct={stock.sentiment.bullishPct}
                  />
                </div>
              )}

              {/* Col 5: Mentions */}
              <div className="text-right">
                <span className="text-[13px] font-medium text-body">{stock.mentions30d}</span>
              </div>

              {/* Col 6: Creators (desktop only) */}
              {!isMobile && (
                <div className="text-right">
                  <span className="text-[13px] font-medium text-body">{stock.distinctCreators}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
