import { useRef, useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStockDetail, useStockMarkers } from '../api/hooks.js'
import SentimentIcon from '../components/SentimentIcon.js'
import SentimentBar from '../components/SentimentBar.js'
import StockIcon from '../components/StockIcon.js'
import { fmtPrice, fmtPct, fmtDate, fmtRelDate } from '../utils/format.js'
import { SENTIMENT_META, bullishPctToVerdict } from '@stonktube/shared'
import type { Marker } from '../api/hooks.js'
import { useLang, useLangNavigate } from '../hooks/useLang.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

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
type MarkerGroup = { date: string; markers: PositionedMarker[]; svgX: number; svgY: number; flip: boolean }

const STEM = 46
const AVATAR_REACH = 84

const YT_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF0000', flexShrink: 0 }}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)

function MarkerTooltip({ group, style, onMouseEnter, onMouseLeave }: {
  group: MarkerGroup
  style: CSSProperties
  onMouseEnter: () => void
  onMouseLeave: () => void
  isMobile?: boolean
}) {
  const navigate = useLangNavigate()
  const { t } = useTranslation()
  const multi = group.markers.length > 1
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        width: 260,
        background: '#14151A',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 12px 32px -8px rgba(20,21,26,0.4)',
        zIndex: 20,
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* Date header for multi-marker groups */}
      {multi && (
        <div className="text-[11px] font-semibold mb-2" style={{ color: '#9A9BA4' }}>
          {fmtDate(group.date)} · {group.markers.length} {t('stock.calls')}
        </div>
      )}

      {group.markers.map((marker, i) => {
        const meta = SENTIMENT_META[marker.sentiment]
        return (
          <div key={marker.videoId}>
            {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />}
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={() => navigate(`/creators/${marker.creatorSlug}`)}
                className="flex items-center justify-center rounded-full text-white font-bold shrink-0 transition-transform duration-150 hover:scale-105"
                style={{ width: 26, height: 26, background: marker.creatorColor, fontSize: 10, border: '2px solid rgba(255,255,255,0.25)' }}
                title={`View ${marker.creatorName}'s profile`}
              >
                {marker.creatorInitial}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/creators/${marker.creatorSlug}`)}
                  className="text-white text-[11px] font-semibold truncate hover:underline text-left block w-full"
                >
                  {marker.creatorName}
                </button>
                {!multi && <div className="text-[10px]" style={{ color: '#9A9BA4' }}>{fmtDate(marker.date)}</div>}
              </div>
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                style={{ background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 600 }}
              >
                <SentimentIcon sentiment={marker.sentiment} size={9} color={meta.color} />
                {t(`sentiment.${marker.sentiment.toLowerCase()}`)}
              </div>
            </div>
            {marker.note && (
              <p className="text-[11px] leading-snug mb-1.5" style={{ color: '#B6B7BE', fontStyle: 'italic' }}>
                {marker.note}
              </p>
            )}
            <a
              href={marker.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium hover:underline"
              style={{ color: '#6E6F78' }}
            >
              {YT_ICON}
              {t('stock.watch_youtube')}
            </a>
          </div>
        )
      })}

      <div className="text-[10px] mt-2" style={{ color: '#6E6F78' }}>
        {t('stock.price_at_mention')} ·{' '}
        <span style={{ color: '#B6B7BE', fontFamily: '"JetBrains Mono", monospace' }}>
          {group.markers[0].priceLabel}
        </span>
      </div>
    </div>
  )
}

function MarkerDot({ group, onShow, onHide, isMobile = false }: {
  group: MarkerGroup; onShow: () => void; onHide: () => void; isMobile?: boolean
}) {
  const multi = group.markers.length > 1
  const first = group.markers[0]
  const flip = group.flip

  const avatarBg = multi ? '#3D3F4A' : first.creatorColor
  const stemColor = multi ? '#6E6F78' : first.creatorColor
  const dotColor = multi ? '#6E6F78' : first.creatorColor

  // Scaled sizes for mobile
  const AVATAR_SIZE = isMobile ? 22 : 34
  const STEM_H = isMobile ? 24 : STEM
  const REACH = isMobile ? 48 : AVATAR_REACH
  const DOT_SIZE = isMobile ? 7 : 9

  return (
    <div
      style={{
        position: 'absolute',
        left: `${group.svgX / 10}%`,
        top: `${group.svgY / 3.6}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onShow}
      onMouseLeave={onHide}
      onClick={onShow}
    >
      {/* Stem */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          [flip ? 'top' : 'bottom']: '100%',
          transform: 'translateX(-50%)',
          width: 1.5,
          height: STEM_H,
          background: stemColor,
          [flip ? 'marginTop' : 'marginBottom']: 3,
          opacity: isMobile ? 0.6 : 1,
        }}
      />
      {/* Avatar / multi-badge */}
      <div
        style={{
          position: 'absolute',
          [flip ? 'top' : 'bottom']: `calc(100% + ${REACH - AVATAR_SIZE}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: '50%',
          background: avatarBg,
          border: `${isMobile ? 1.5 : 2.5}px solid white`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: isMobile ? (multi ? 9 : 8) : (multi ? 14 : 12),
          letterSpacing: multi ? '-1px' : undefined,
        }}
      >
        {multi ? '···' : first.creatorInitial}
        {/* Badge: count for multi, sentiment icon for single */}
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            minWidth: isMobile ? 13 : 18,
            height: isMobile ? 13 : 18,
            borderRadius: 9,
            background: multi ? '#4F46E5' : SENTIMENT_META[first.sentiment].color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid white',
            fontSize: isMobile ? 7 : 9,
            fontWeight: 700,
            color: 'white',
            padding: '0 2px',
          }}
        >
          {multi ? group.markers.length : <SentimentIcon sentiment={first.sentiment} size={isMobile ? 7 : 10} color="white" />}
        </div>
      </div>
      {/* Dot at price point */}
      <div
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          background: dotColor,
          border: '2px solid white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  )
}

function tooltipPosition(group: MarkerGroup, isMobile = false): CSSProperties {
  const CARD_H = group.markers.length === 1 ? 200 : Math.min(group.markers.length * 110 + 50, 340)
  const PAD = 4
  const GAP = isMobile ? 6 : 18
  const REACH = isMobile ? 48 : AVATAR_REACH
  const dotXpct = group.svgX / 10
  const avatarY = group.svgY + (group.flip ? REACH : -REACH)
  const CHART_H = isMobile ? 240 : 360
  const top = Math.min(Math.max(avatarY - CARD_H / 2, PAD), CHART_H - CARD_H - PAD)
  if (isMobile) {
    // On mobile pin the card to the sides to avoid overflow
    return dotXpct > 50
      ? { top, right: 4, maxWidth: 'calc(100% - 8px)' }
      : { top, left: 4, maxWidth: 'calc(100% - 8px)' }
  }
  const placeLeft = dotXpct > 58
  return placeLeft
    ? { top, right: `calc(${100 - dotXpct}% + ${GAP}px)` }
    : { top, left: `calc(${dotXpct}% + ${GAP}px)` }
}

interface StockDetailProps {
  onSummaryClick: (id: string) => void
}

export default function StockDetail({ onSummaryClick }: StockDetailProps) {
  const { ticker = '' } = useParams<{ ticker: string }>()
  const navigate = useLangNavigate()
  const { t } = useTranslation()
  const { lang } = useLang()
  const [tf, setTf] = useState('3M')

  // Adapt marker sizes / layout on mobile. Keyed off the viewport rather than a
  // measured element so it stays correct even though the chart only mounts after
  // data loads (an element-based observer would miss that first render).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Hover state keyed by date string so grouped markers share one active state.
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const showMarker = (date: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setActiveDate(date)
  }
  const hideMarker = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setActiveDate(null), 140)
  }

  // Crosshair — index into priceSeries while mouse is over chart
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (priceSeries.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    // Map cursor X → calendar date → nearest price point (X is calendar-based).
    const targetMs = domainStart + ((e.clientX - rect.left) / rect.width) * domainSpan
    let nearestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < priceMsList.length; i++) {
      const diff = Math.abs(priceMsList[i] - targetMs)
      if (diff < bestDiff) { bestDiff = diff; nearestIdx = i }
    }
    setHoverIdx(nearestIdx)
  }

  const { data, isLoading, error } = useStockDetail(ticker, tf, lang)
  const { data: markers } = useStockMarkers(ticker, tf, lang)
  usePageMeta(
    data?.stock
      ? `${data.stock.name} (${ticker.toUpperCase()}) · StonkTube`
      : `${ticker.toUpperCase()} · StonkTube`,
    data?.stock
      ? `See what YouTube finance creators say about ${data.stock.name} (${ticker.toUpperCase()}) — sentiment ratings, recent coverage, and price history.`
      : undefined,
  )

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">{t('stock.loading')}</div>
  }

  if (error || !data) {
    return <div className="py-12 text-center text-bear text-sm">{t('stock.error')}</div>
  }

  const { stock, priceSeries, recentCoverage, overallSentiment } = data
  const isUp = stock.dayChangePct >= 0
  const changeColor = isUp ? '#0F9D63' : '#E5484D'
  const verdict = bullishPctToVerdict(overallSentiment.bullishPct)

  const SVG_W = 1000
  const SVG_H = 360
  const priceValues = priceSeries.map(p => p.close)
  const { gridPrices, totalRange, min: priceMin } = scalePoints(priceValues, SVG_W, SVG_H)

  const hi = priceMin + (totalRange ?? 1)

  function priceToSvgY(price: number): number {
    if (!totalRange) return SVG_H / 2
    return SVG_H - ((price - priceMin) / (hi - priceMin || 1)) * SVG_H
  }

  const isPrivate = priceSeries.length === 0

  // ── Calendar-based X axis ──────────────────────────────────────────────────
  // The X axis maps real dates (not trading-day indices) so mentions that
  // predate the price history — e.g. pre-IPO calls — land on their actual date
  // instead of snapping to the first available price point. The domain spans
  // both the price series and the markers.
  const priceMsList = priceSeries.map(p => new Date(p.date).getTime())
  const firstPriceMs = priceMsList.length ? priceMsList[0] : null
  const lastPriceMs = priceMsList.length ? priceMsList[priceMsList.length - 1] : null
  const markerMs = (markers ?? []).map(m => new Date(m.date).getTime())
  const markerMinMs = markerMs.length ? Math.min(...markerMs) : null
  const markerMaxMs = markerMs.length ? Math.max(...markerMs) : null

  let domainStart = firstPriceMs ?? markerMinMs ?? Date.now()
  let domainEnd = lastPriceMs ?? markerMaxMs ?? Date.now()
  if (markerMinMs != null) domainStart = Math.min(domainStart, markerMinMs)
  if (markerMaxMs != null) domainEnd = Math.max(domainEnd, markerMaxMs)
  // Pad the side(s) where markers run past the price line so avatars aren't clipped.
  const rawSpan = domainEnd - domainStart || 1
  if (firstPriceMs == null || (markerMinMs != null && markerMinMs < firstPriceMs)) domainStart -= rawSpan * 0.05
  if (lastPriceMs == null || (markerMaxMs != null && markerMaxMs > lastPriceMs)) domainEnd += rawSpan * 0.05
  const domainSpan = domainEnd - domainStart || 1
  const dateToSvgX = (ms: number) => ((ms - domainStart) / domainSpan) * SVG_W

  // Price line / area, positioned by calendar date.
  const pricePts = priceSeries.map((p, i) => `${dateToSvgX(priceMsList[i])},${priceToSvgY(p.close)}`).join(' ')
  const firstPriceX = firstPriceMs != null ? dateToSvgX(firstPriceMs) : 0
  const lastPriceX = lastPriceMs != null ? dateToSvgX(lastPriceMs) : SVG_W

  // Date ticks: 6 evenly spaced across the calendar domain.
  const dateTicks = priceSeries.length >= 2 || (markers?.length ?? 0) > 0
    ? Array.from({ length: 6 }, (_, i) => new Date(domainStart + (i / 5) * domainSpan))
    : []

  // Position each marker by calendar date. In-range markers snap to the nearest
  // price vertex so the dot sits on the line; markers outside the price range
  // (e.g. pre-IPO) sit at the nearest endpoint's price level.
  const positionedMarkers = (markers ?? []).map(m => {
    const mMs = new Date(m.date).getTime()
    if (isPrivate) {
      return { ...m, svgX: dateToSvgX(mMs), svgY: SVG_H / 2, flip: false }
    }
    if (firstPriceMs != null && mMs < firstPriceMs) {
      const svgY = priceToSvgY(priceSeries[0].close)
      return { ...m, svgX: dateToSvgX(mMs), svgY, flip: svgY < AVATAR_REACH + 12 }
    }
    if (lastPriceMs != null && mMs > lastPriceMs) {
      const svgY = priceToSvgY(priceSeries[priceSeries.length - 1].close)
      return { ...m, svgX: dateToSvgX(mMs), svgY, flip: svgY < AVATAR_REACH + 12 }
    }
    let nearestIdx = 0
    let bestDiff = Infinity
    for (let i = 0; i < priceSeries.length; i++) {
      const diff = Math.abs(priceMsList[i] - mMs)
      if (diff < bestDiff) { bestDiff = diff; nearestIdx = i }
    }
    const svgY = priceToSvgY(priceSeries[nearestIdx].close)
    return { ...m, svgX: dateToSvgX(priceMsList[nearestIdx]), svgY, flip: svgY < AVATAR_REACH + 12 }
  })

  // Group markers by date — multiple calls on the same day share one dot
  const markerGroups: MarkerGroup[] = (() => {
    const map = new Map<string, PositionedMarker[]>()
    for (const m of positionedMarkers) {
      const arr = map.get(m.date) ?? []
      arr.push(m)
      map.set(m.date, arr)
    }
    return [...map.values()].map(markers => ({
      date: markers[0].date,
      markers,
      svgX: markers[0].svgX,
      svgY: markers[0].svgY,
      flip: markers[0].flip,
    }))
  })()

  const activeGroup = markerGroups.find(g => g.date === activeDate)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-primary transition-colors duration-150 self-start"
      >
        {t('stock.back')}
      </button>

      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <StockIcon
            logoUrl={stock.logoUrl}
            initials={stock.initials}
            brandColor={stock.brandColor}
            logoBg={stock.logoBg}
            size={54}
            radius={14}
            fontSize={16}
          />
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
                  {t('stock.private')}
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted mt-0.5">
              {stock.name} · {stock.sector}
            </div>
          </div>
        </div>
        <div className="text-right">
          {!isPrivate && (
            <>
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
                  {fmtPct(stock.dayChangePct)} {t('stock.today')}
                </span>
              </div>
            </>
          )}
          <div className="text-[12px] text-muted mt-1">
            {stock.trackedBy === 1 ? t('stock.tracked_by_one', { count: stock.trackedBy }) : t('stock.tracked_by_other', { count: stock.trackedBy })}
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
            {t('stock.creator_sentiment')}
          </div>
        </div>

        {/* Chart SVG with overlay */}
        <div
          className="relative"
          style={{ height: isMobile ? 240 : 360 }}
          onMouseMove={handleChartMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {isPrivate ? (
            /* Private company — no price data: show a simple horizontal timeline */
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              {/* Baseline */}
              <line x1={0} y1={SVG_H / 2} x2={SVG_W} y2={SVG_H / 2} stroke="#E8E7E0" strokeWidth={2} />
            </svg>
          ) : (
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
                    <line x1={0} y1={y} x2={SVG_W - 50} y2={y} stroke="#F0EFE8" strokeWidth={1} />
                    <text
                      x={SVG_W - 4}
                      y={y + 4}
                      textAnchor="end"
                      style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fill: '#B6B7BE' }}
                    >
                      {fmtPrice(gp)}
                    </text>
                  </g>
                )
              })}

              {/* Area fill */}
              {pricePts && (
                <polygon points={`${firstPriceX},${SVG_H} ${pricePts} ${lastPriceX},${SVG_H}`} fill={`url(#area-${ticker})`} />
              )}

              {/* Price line */}
              {pricePts && (
                <polyline
                  points={pricePts}
                  fill="none"
                  stroke={stock.brandColor}
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Crosshair */}
              {hoverIdx !== null && priceSeries.length > 1 && (() => {
                const cx = dateToSvgX(priceMsList[hoverIdx])
                const cy = priceToSvgY(priceSeries[hoverIdx].close)
                return (
                  <g>
                    <line
                      x1={cx} y1={0} x2={cx} y2={SVG_H}
                      stroke="#9A9BA4"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={cx} cy={cy} r={4}
                      fill={stock.brandColor}
                      stroke="white"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                )
              })()}
            </svg>
          )}

          {/* Crosshair date/price label */}
          {!isPrivate && hoverIdx !== null && priceSeries.length > 1 && (() => {
            const pt = priceSeries[hoverIdx]
            const xPct = (dateToSvgX(priceMsList[hoverIdx]) / SVG_W) * 100
            const flipLeft = xPct > 65
            return (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  ...(flipLeft
                    ? { right: `${100 - xPct}%`, marginRight: 10 }
                    : { left: `${xPct}%`, marginLeft: 10 }),
                  background: '#14151A',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", monospace',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                {fmtDate(pt.date)} · {fmtPrice(pt.close)}
              </div>
            )
          })()}

          {/* Creator avatar markers overlay */}
          {markerGroups.length > 0 && (
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              <div className="relative w-full h-full" style={{ pointerEvents: 'none' }}>
                {markerGroups.map(group => (
                  <MarkerDot
                    key={group.date}
                    group={group}
                    onShow={() => showMarker(group.date)}
                    onHide={hideMarker}
                    isMobile={isMobile}
                  />
                ))}
                {activeGroup && (
                  <MarkerTooltip
                    group={activeGroup}
                    style={tooltipPosition(activeGroup, isMobile)}
                    onMouseEnter={() => showMarker(activeGroup.date)}
                    onMouseLeave={hideMarker}
                    isMobile={isMobile}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date ticks */}
        {!isPrivate && (
          <div className="flex justify-between mt-2 px-1">
            {dateTicks.map((tick, i) => (
              <span
                key={i}
                className="text-[11px]"
                style={{ color: '#B6B7BE', fontFamily: '"JetBrains Mono", monospace' }}
              >
                {tick ? fmtDate(tick).replace(/,\s*\d{4}$/, '') : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid gap-7" style={{ gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr' }}>
        {/* Left: Recent coverage — on mobile shown second */}
        <div className="flex flex-col gap-4" style={{ order: isMobile ? 2 : 1 }}>
          <h2
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: '-0.02em',
              color: '#14151A',
            }}
          >
            {t('stock.recent_coverage')}
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
                    <button
                      onClick={() => navigate(`/creators/${event.creatorSlug}`)}
                      className="flex items-center justify-center rounded-full shrink-0 text-white font-bold transition-transform duration-150 hover:scale-105"
                      style={{
                        width: 42,
                        height: 42,
                        background: event.creatorColor,
                        fontSize: 15,
                      }}
                      title={`View ${event.creatorName}'s profile`}
                    >
                      {event.creatorInitial}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => navigate(`/creators/${event.creatorSlug}`)}
                          className="text-[13px] font-semibold text-primary hover:text-accent transition-colors duration-150 text-left"
                        >
                          {event.creatorName}
                        </button>
                        <span className="text-[11px] text-muted shrink-0">{fmtRelDate(event.publishedAt)}</span>
                      </div>
                      <div className="text-[11px] text-muted">{event.creatorHandle}</div>
                      <button
                        onClick={() => onSummaryClick(event.videoId)}
                        className="mt-1.5 block text-[13px] font-semibold text-primary hover:text-accent transition-colors duration-150 leading-snug text-left"
                      >
                        {event.title}
                      </button>
                      {event.note && (
                        <p
                          className="mt-1.5 text-[12.5px] leading-snug"
                          style={{ color: '#6E6F78', fontStyle: 'italic' }}
                        >
                          “{event.note}”
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          <SentimentIcon sentiment={event.sentiment} size={10} color={meta.color} />
                          {t(`sentiment.${event.sentiment.toLowerCase()}`)}
                        </div>
                        <span className="text-[11px] text-muted">
                          @ {fmtPrice(event.priceAtMention)}
                        </span>
                        <button
                          onClick={() => onSummaryClick(event.videoId)}
                          className="ml-auto text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors duration-150"
                          style={{ background: '#F3F2EC', color: '#6E6F78' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#E8E7E0')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F3F2EC')}
                        >
                          {t('stock.summary_btn')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Overall sentiment — on mobile shown first */}
        <div className={isMobile ? '' : 'sticky top-[90px]'} style={{ order: isMobile ? 1 : 2 }}>
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
              {t('stock.overall_sentiment')}
            </h2>
            <p className="text-[12px] text-muted mt-0.5 mb-4">
              {overallSentiment.total === 1 ? t('stock.ratings_one', { count: overallSentiment.total }) : t('stock.ratings_other', { count: overallSentiment.total })}
            </p>

            {overallSentiment.total > 0 && (() => {
              const { bullCount, neutralCount, bearCount, bullishPct, neutralPct, bearishPct } = overallSentiment
              const isBearDominant = bearCount > bullCount && bearCount >= neutralCount
              const isNeutralDominant = !isBearDominant && neutralCount > bullCount
              const dominantPct = isBearDominant ? bearishPct : isNeutralDominant ? neutralPct : bullishPct
              const dominantColor = isBearDominant ? '#E5484D' : isNeutralDominant ? '#D9B26A' : '#0F9D63'
              const subtitleKey = isBearDominant ? 'stock.of_creators_bearish' : isNeutralDominant ? 'stock.of_creators_neutral' : 'stock.of_creators_bullish'
              return <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 700,
                      fontSize: 44,
                      color: dominantColor,
                      lineHeight: 1,
                    }}
                  >
                    {dominantPct.toFixed(0)}%
                  </span>
                  <span className="text-[16px] font-semibold" style={{ color: dominantColor }}>
                    {t(`verdict.${verdict}`, verdict)}
                  </span>
                </div>
                <p className="text-[13px] text-muted mb-4">{t(subtitleKey)}</p>

              <SentimentBar
                bullishPct={overallSentiment.bullishPct}
                neutralPct={overallSentiment.neutralPct}
                bearishPct={overallSentiment.bearishPct}
              />

              {/* Legend */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#0F9D63' }} />
                    <span className="text-body">{t('sentiment.bullish')}</span>
                  </div>
                  <span className="font-semibold text-primary">{overallSentiment.bullCount}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#D9B26A' }} />
                    <span className="text-body">{t('sentiment.neutral')}</span>
                  </div>
                  <span className="font-semibold text-primary">{overallSentiment.neutralCount}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: '#E5484D' }} />
                    <span className="text-body">{t('sentiment.bearish')}</span>
                  </div>
                  <span className="font-semibold text-primary">{overallSentiment.bearCount}</span>
                </div>
              </div>
            </>
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
