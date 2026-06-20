import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStockDetail, useStockMarkers } from '../api/hooks.js'
import SentimentIcon from '../components/SentimentIcon.js'
import SentimentBar from '../components/SentimentBar.js'
import { fmtPrice, fmtPct, fmtDate, fmtRelDate } from '../utils/format.js'
import { SENTIMENT_META, bullishPctToVerdict } from '@stonktube/shared'
import type { Marker } from '../api/hooks.js'

const TF_OPTIONS = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
]

function scalePoints(values: number[], svgW: number, svgH: number) {
  if (!values || values.length < 2) return { pts: '', min: 0, max: 1, gridPrices: [] }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = range * 0.08
  const lo = min - pad
  const hi = max + pad
  const totalRange = hi - lo

  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * svgW
      const y = svgH - ((v - lo) / totalRange) * svgH
      return `${x},${y}`
    })
    .join(' ')

  const gridPrices = Array.from({ length: 5 }, (_, i) => lo + (totalRange / 4) * i).reverse()

  return { pts, min: lo, max: hi, gridPrices, totalRange }
}

type PositionedMarker = Marker & { svgX: number; svgY: number; flip: boolean }

interface MarkerTooltipProps {
  marker: PositionedMarker
  style: CSSProperties
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function MarkerTooltip({ marker, style, onMouseEnter, onMouseLeave }: MarkerTooltipProps) {
  const meta = SENTIMENT_META[marker.sentiment]
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        width: 248,
        background: '#14151A',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 12px 32px -8px rgba(20,21,26,0.4)',
        zIndex: 20,
        pointerEvents: 'auto',
        ...style,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
          style={{
            width: 28,
            height: 28,
            background: marker.creatorColor,
            fontSize: 11,
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        >
          {marker.creatorInitial}
        </div>
        <div>
          <div className="text-white text-[12px] font-semibold">{marker.creatorName}</div>
          <div className="text-[10px]" style={{ color: '#9A9BA4' }}>
            {fmtDate(marker.date)}
          </div>
        </div>
        <div
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600 }}
        >
          <SentimentIcon sentiment={marker.sentiment} size={10} color={meta.color} />
          {meta.label}
        </div>
      </div>
      {marker.note && (
        <p className="text-[11px] leading-snug mb-2" style={{ color: '#B6B7BE', fontStyle: 'italic' }}>
          {marker.note}
        </p>
      )}
      <a
        href={marker.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[11px] font-medium mb-2 hover:underline"
        style={{ color: '#6E6F78' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF0000', flexShrink: 0 }}>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        Watch on YouTube
      </a>
      <div className="text-[10px]" style={{ color: '#6E6F78' }}>
        Price at mention ·{' '}
        <span style={{ color: '#B6B7BE', fontFamily: '"JetBrains Mono", monospace' }}>
          {marker.priceLabel}
        </span>
      </div>
    </div>
  )
}

interface MarkerDotProps {
  marker: PositionedMarker
  onShow: () => void
  onHide: () => void
}

const STEM = 46
// Distance from the dot to the centre of the floating avatar, along the stem.
const AVATAR_REACH = 84

function MarkerDot({ marker, onShow, onHide }: MarkerDotProps) {
  const meta = SENTIMENT_META[marker.sentiment]
  const flip = marker.flip

  return (
    <div
      style={{
        position: 'absolute',
        left: `${marker.svgX / 10}%`,
        top: `${marker.svgY / 3.6}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onShow}
      onMouseLeave={onHide}
    >
      {/* Stem */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          [flip ? 'top' : 'bottom']: '100%',
          transform: 'translateX(-50%)',
          width: 2,
          height: STEM,
          background: marker.creatorColor,
          [flip ? 'marginTop' : 'marginBottom']: 4,
        }}
      />
      {/* Avatar */}
      <div
        style={{
          position: 'absolute',
          [flip ? 'top' : 'bottom']: `calc(100% + ${AVATAR_REACH - 34}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: marker.creatorColor,
          border: '2.5px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {marker.creatorInitial}
        {/* Sentiment badge */}
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: meta.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid white',
          }}
        >
          <SentimentIcon sentiment={marker.sentiment} size={10} color="white" />
        </div>
      </div>
      {/* Dot at price point */}
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: marker.creatorColor,
          border: '2px solid white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  )
}

// Place the hover card to the side of the marker, vertically centred on the
// avatar but clamped inside the 360px chart so it never spills over the legend
// or off the bottom. Flips to the left when the marker sits in the right third.
function tooltipPosition(marker: PositionedMarker): CSSProperties {
  const CARD_H = 240
  const PAD = 8
  const GAP = 18
  const dotXpct = marker.svgX / 10 // 0–100
  const avatarY = marker.svgY + (marker.flip ? AVATAR_REACH : -AVATAR_REACH)
  const top = Math.min(Math.max(avatarY - CARD_H / 2, PAD), 360 - CARD_H - PAD)
  const placeLeft = dotXpct > 58
  return placeLeft
    ? { top, right: `calc(${100 - dotXpct}% + ${GAP}px)` }
    : { top, left: `calc(${dotXpct}% + ${GAP}px)` }
}

export default function StockDetail() {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const [tf, setTf] = useState('3M')

  // Hover state for marker tooltips. A short hide delay lets the pointer travel
  // from the avatar across the gap onto the card without the card vanishing.
  const [activeId, setActiveId] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const showMarker = (id: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setActiveId(id)
  }
  const hideMarker = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setActiveId(null), 140)
  }

  const { data, isLoading, error } = useStockDetail(ticker, tf)
  const { data: markers } = useStockMarkers(ticker, tf)

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">Loading…</div>
  }

  if (error || !data) {
    return <div className="py-12 text-center text-bear text-sm">Failed to load stock detail.</div>
  }

  const { stock, priceSeries, recentCoverage, overallSentiment } = data
  const isUp = stock.dayChangePct >= 0
  const changeColor = isUp ? '#0F9D63' : '#E5484D'
  const verdict = bullishPctToVerdict(overallSentiment.bullishPct)

  const SVG_W = 1000
  const SVG_H = 360
  const priceValues = priceSeries.map(p => p.close)
  const { pts, gridPrices, totalRange, min: priceMin } = scalePoints(priceValues, SVG_W, SVG_H)

  // Date ticks: 6 evenly spaced
  const dateTicks = priceSeries.length >= 2
    ? Array.from({ length: 6 }, (_, i) => {
        const idx = Math.round((i / 5) * (priceSeries.length - 1))
        return priceSeries[idx]
      })
    : []

  const hi = priceMin + (totalRange ?? 1)

  function priceToSvgY(price: number): number {
    if (!totalRange) return SVG_H / 2
    return SVG_H - ((price - priceMin) / (hi - priceMin || 1)) * SVG_H
  }

  // Snap each marker to the nearest price-series point so the dot sits exactly
  // on the line. The line is drawn with index-based X spacing (trading days are
  // evenly spaced, weekends skipped), so we match by index, not calendar time.
  const positionedMarkers = (markers ?? []).map(m => {
    const mMs = new Date(m.date).getTime()
    let nearestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < priceSeries.length; i++) {
      const diff = Math.abs(new Date(priceSeries[i].date).getTime() - mMs)
      if (diff < bestDiff) {
        bestDiff = diff
        nearestIdx = i
      }
    }
    const n = priceSeries.length
    const svgY = priceToSvgY(priceSeries[nearestIdx]?.close ?? 0)
    return {
      ...m,
      svgX: n > 1 ? (nearestIdx / (n - 1)) * SVG_W : SVG_W / 2,
      svgY,
      // Not enough headroom above for the avatar → flip the marker downward so
      // it doesn't clip the chart top or collide with the legend.
      flip: svgY < AVATAR_REACH + 12,
    }
  })

  const activeMarker = positionedMarkers.find(m => m.videoId === activeId)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-primary transition-colors duration-150 self-start"
      >
        ‹ Dashboard
      </button>

      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: stock.logoBg || '#F0EFE8',
            }}
          >
            <span
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 16,
                color: stock.brandColor,
              }}
            >
              {stock.initials}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600,
                  fontSize: 24,
                  color: '#14151A',
                }}
              >
                {stock.ticker}
              </span>
              {stock.isPrivate && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#FBF3E2', color: '#8A6D3B' }}
                >
                  Private
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted mt-0.5">
              {stock.name} · {stock.sector}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600,
              fontSize: 30,
              color: '#14151A',
              lineHeight: 1,
            }}
          >
            {stock.priceStr}
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="text-[14px] font-semibold" style={{ color: changeColor }}>
              {fmtPct(stock.dayChangePct)} today
            </span>
          </div>
          <div className="text-[12px] text-muted mt-1">
            Tracked by {stock.trackedBy} creator{stock.trackedBy !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-white" style={{ borderRadius: 18, padding: 22, border: '1px solid #ECEBE4' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-0.5 p-1"
            style={{ background: '#F3F2EC', borderRadius: 10 }}
          >
            {TF_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTf(opt.value)}
                className="px-3 py-1 text-[13px] font-semibold transition-all duration-150"
                style={{
                  borderRadius: 8,
                  background: tf === opt.value ? 'white' : 'transparent',
                  color: tf === opt.value ? '#14151A' : '#6E6F78',
                  boxShadow: tf === opt.value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: '#6E6F78' }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: stock.brandColor }}
            />
            Creator sentiment at time of video
          </div>
        </div>

        {/* Chart SVG with overlay */}
        <div className="relative" style={{ height: 360 }}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id={`area-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stock.brandColor} stopOpacity="0.16" />
                <stop offset="100%" stopColor={stock.brandColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {gridPrices && gridPrices.map((gp, i) => {
              const y = priceToSvgY(gp)
              return (
                <g key={i}>
                  <line
                    x1={0}
                    y1={y}
                    x2={SVG_W - 50}
                    y2={y}
                    stroke="#F0EFE8"
                    strokeWidth={1}
                  />
                  <text
                    x={SVG_W - 4}
                    y={y + 4}
                    textAnchor="end"
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 11,
                      fill: '#B6B7BE',
                    }}
                  >
                    {fmtPrice(gp)}
                  </text>
                </g>
              )
            })}

            {/* Area fill */}
            {pts && (
              <polygon
                points={`0,${SVG_H} ${pts} ${SVG_W},${SVG_H}`}
                fill={`url(#area-${ticker})`}
              />
            )}

            {/* Price line */}
            {pts && (
              <polyline
                points={pts}
                fill="none"
                stroke={stock.brandColor}
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Creator avatar markers overlay */}
          {positionedMarkers.length > 0 && (
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              <div className="relative w-full h-full" style={{ pointerEvents: 'none' }}>
                {positionedMarkers.map(marker => (
                  <MarkerDot
                    key={marker.videoId}
                    marker={marker}
                    onShow={() => showMarker(marker.videoId)}
                    onHide={hideMarker}
                  />
                ))}
                {activeMarker && (
                  <MarkerTooltip
                    marker={activeMarker}
                    style={tooltipPosition(activeMarker)}
                    onMouseEnter={() => showMarker(activeMarker.videoId)}
                    onMouseLeave={hideMarker}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date ticks */}
        <div className="flex justify-between mt-2 px-1">
          {dateTicks.map((tick, i) => (
            <span
              key={i}
              className="text-[11px]"
              style={{ color: '#B6B7BE', fontFamily: '"JetBrains Mono", monospace' }}
            >
              {tick ? fmtDate(tick.date).replace(/,\s*\d{4}$/, '') : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-7" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* Left: Recent coverage */}
        <div className="flex flex-col gap-4">
          <h2
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: '-0.02em',
              color: '#14151A',
            }}
          >
            Recent creator coverage
          </h2>
          <div className="flex flex-col gap-3">
            {recentCoverage.map(event => {
              const meta = SENTIMENT_META[event.sentiment]
              return (
                <div
                  key={event.videoId}
                  className="bg-white border border-[#ECEBE4] p-4 transition-colors duration-150"
                  style={{ borderRadius: 14 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#D6D5CC')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#ECEBE4')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center rounded-full shrink-0 text-white font-bold"
                      style={{
                        width: 42,
                        height: 42,
                        background: event.creatorColor,
                        fontSize: 15,
                      }}
                    >
                      {event.creatorInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-primary">{event.creatorName}</span>
                        <span className="text-[11px] text-muted shrink-0">{fmtRelDate(event.publishedAt)}</span>
                      </div>
                      <div className="text-[11px] text-muted">{event.creatorHandle}</div>
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 block text-[13px] font-semibold text-primary hover:text-accent transition-colors duration-150 leading-snug"
                      >
                        {event.title}
                      </a>
                      <div className="flex items-center gap-2 mt-2">
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          <SentimentIcon sentiment={event.sentiment} size={10} color={meta.color} />
                          {meta.label}
                        </div>
                        <span className="text-[11px] text-muted">
                          @ {fmtPrice(event.priceAtMention)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Overall sentiment */}
        <div className="sticky top-[90px]">
          <div
            className="bg-white border border-[#ECEBE4] p-5"
            style={{ borderRadius: 18 }}
          >
            <h2
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: '-0.015em',
                color: '#14151A',
              }}
            >
              Overall sentiment
            </h2>
            <p className="text-[12px] text-muted mt-0.5 mb-4">
              Based on {overallSentiment.total} recent rating{overallSentiment.total !== 1 ? 's' : ''}
            </p>

            <div className="flex items-baseline gap-2 mb-1">
              <span
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: 44,
                  color: '#0F9D63',
                  lineHeight: 1,
                }}
              >
                {overallSentiment.bullishPct.toFixed(0)}%
              </span>
              <span
                className="text-[16px] font-semibold"
                style={{ color: '#0F9D63' }}
              >
                {verdict}
              </span>
            </div>
            <p className="text-[13px] text-muted mb-4">of creators are bullish</p>

            <SentimentBar
              bullCount={overallSentiment.bullCount}
              neutralCount={overallSentiment.neutralCount}
              bearCount={overallSentiment.bearCount}
              bullishPct={overallSentiment.bullishPct}
            />

            {/* Legend */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#0F9D63' }} />
                  <span className="text-body">Bullish</span>
                </div>
                <span className="font-semibold text-primary">{overallSentiment.bullCount}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#D9B26A' }} />
                  <span className="text-body">Neutral</span>
                </div>
                <span className="font-semibold text-primary">{overallSentiment.neutralCount}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#E5484D' }} />
                  <span className="text-body">Bearish</span>
                </div>
                <span className="font-semibold text-primary">{overallSentiment.bearCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
