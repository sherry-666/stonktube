import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../api/hooks.js'
import Sparkline from '../components/Sparkline.js'
import VideoCard from '../components/VideoCard.js'
import type { VideoCardDTO } from '../components/VideoCard.js'
import { fmtPrice, fmtPct } from '../utils/format.js'

interface DashboardProps {
  onSummaryClick: (id: string) => void
}

export default function Dashboard({ onSummaryClick }: DashboardProps) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useDashboard()

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">Loading…</div>
  }

  if (error || !data) {
    return <div className="py-12 text-center text-bear text-sm">Failed to load dashboard.</div>
  }

  const maxMentions = data.mostMentioned.length > 0
    ? Math.max(...data.mostMentioned.map(r => r.mentions30d))
    : 1

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <h1
        className="font-display font-bold text-[30px] sm:text-[36px] md:text-[42px] tracking-[-0.03em]"
        style={{
          lineHeight: 1.05,
          color: '#14151A',
          maxWidth: 680,
        }}
      >
        What the creators are calling.
      </h1>

      {/* Stock pills row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {data.pills.map(pill => {
          const isUp = pill.dayChangePct >= 0
          const changeColor = isUp ? '#0F9D63' : '#E5484D'
          const sparkColor = pill.brandColor || (isUp ? '#0F9D63' : '#E5484D')

          return (
            <button
              key={pill.ticker}
              onClick={() => navigate(`/stocks/${pill.ticker}`)}
              className="bg-white border border-[#ECEBE4] text-left transition-all duration-150 cursor-pointer w-full"
              style={{ borderRadius: 16, padding: 18 }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.transform = 'translateY(-3px)'
                el.style.boxShadow = '0 12px 28px -12px rgba(20,21,26,0.18)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.transform = ''
                el.style.boxShadow = ''
              }}
            >
              {/* Top row: ticker + bullish chip */}
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontWeight: 600,
                      fontSize: 16,
                      color: '#14151A',
                    }}
                  >
                    {pill.ticker}
                  </div>
                  <div style={{ fontSize: 12, color: '#9A9BA4', marginTop: 1 }}>{pill.name}</div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5"
                  style={{
                    background: '#E7F6EE',
                    color: '#0F9D63',
                    borderRadius: 8,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pill.bullishPct.toFixed(0)}% bullish
                </span>
              </div>

              {/* Sparkline — fills pill width */}
              <div className="my-2">
                <Sparkline
                  points={pill.sparkline}
                  height={38}
                  color={sparkColor}
                />
              </div>

              {/* Price + change */}
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600,
                    fontSize: 18,
                    color: '#14151A',
                  }}
                >
                  {pill.priceStr}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: changeColor }}>
                  {fmtPct(pill.dayChangePct)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Body grid */}
      <div className="grid gap-6 lg:gap-7 grid-cols-1 lg:grid-cols-[1.55fr_1fr]">
        {/* Left: Latest analysis */}
        <div className="flex flex-col gap-4">
          <div>
            <h2
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 21,
                letterSpacing: '-0.02em',
                color: '#14151A',
              }}
            >
              Latest analysis
            </h2>
            <p className="text-sm text-muted mt-0.5">Across 6 creators</p>
          </div>
          <div className="flex flex-col gap-3">
            {data.feed.map(video => (
              <VideoCard
                key={video.id}
                video={video as VideoCardDTO}
                onSummaryClick={onSummaryClick}
              />
            ))}
          </div>
        </div>

        {/* Right: leaderboards */}
        <div className="flex flex-col gap-6">
          {/* Most mentioned */}
          <div
            className="bg-white"
            style={{ borderRadius: 16, padding: 20, border: '1px solid #ECEBE4' }}
          >
            <h2
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 16,
                color: '#14151A',
              }}
            >
              Most mentioned
            </h2>
            <p className="text-[12px] text-muted mt-0.5 mb-4">Total mentions · last 30 days</p>
            <div className="flex flex-col gap-3">
              {data.mostMentioned.map((row, idx) => (
                <button
                  key={row.ticker}
                  onClick={() => navigate(`/stocks/${row.ticker}`)}
                  className="flex items-center gap-3 w-full text-left cursor-pointer"
                >
                  <span className="text-[12px] text-faint w-4 shrink-0">{idx + 1}</span>
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: row.brandColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-semibold mb-1"
                      style={{ fontFamily: '"JetBrains Mono", monospace', color: '#14151A' }}
                    >
                      {row.ticker}
                    </div>
                    <div
                      className="rounded-full"
                      style={{
                        height: 4,
                        background: '#F0EFE8',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(row.mentions30d / maxMentions) * 100}%`,
                          background: row.brandColor,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold text-muted shrink-0">
                    {row.mentions30d}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Most bullish */}
          <div
            className="bg-white"
            style={{ borderRadius: 16, padding: 20, border: '1px solid #ECEBE4' }}
          >
            <h2
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 16,
                color: '#14151A',
              }}
            >
              Most bullish
            </h2>
            <p className="text-[12px] text-muted mt-0.5 mb-4">Share of positive ratings</p>
            <div className="flex flex-col gap-3">
              {data.mostBullish.map((row, idx) => {
                const verdictColor =
                  row.verdict === 'Strong buy' || row.verdict === 'Buy'
                    ? '#0F9D63'
                    : row.verdict === 'Mixed'
                    ? '#D9B26A'
                    : '#E5484D'

                return (
                  <button
                    key={row.ticker}
                    onClick={() => navigate(`/stocks/${row.ticker}`)}
                    className="flex items-center gap-3 w-full text-left cursor-pointer"
                  >
                    <span className="text-[12px] text-faint w-4 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ fontFamily: '"JetBrains Mono", monospace', color: '#14151A' }}
                        >
                          {row.ticker}
                        </span>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: verdictColor }}
                        >
                          {row.verdict}
                        </span>
                      </div>
                      <div
                        className="rounded-full"
                        style={{ height: 4, background: '#F0EFE8', overflow: 'hidden' }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${row.bullishPct}%`,
                            background: '#0F9D63',
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-[12px] font-semibold shrink-0"
                      style={{ color: '#0F9D63' }}
                    >
                      {row.bullishPct.toFixed(0)}%
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
