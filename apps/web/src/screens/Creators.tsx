import { Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCreators } from '../api/hooks.js'
import StockChip from '../components/StockChip.js'
import { fmtSubs, fmtRelDate, fmtDuration } from '../utils/format.js'

interface CreatorsProps {
  onSummaryClick: (id: string) => void
}

export default function Creators({ onSummaryClick }: CreatorsProps) {
  const { data, isLoading, error } = useCreators()
  const navigate = useNavigate()

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">Loading…</div>
  }

  if (error || !data) {
    return <div className="py-12 text-center text-bear text-sm">Failed to load creators.</div>
  }

  return (
    <div className="flex flex-col gap-6">
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
          The Network
        </p>
        <h1
          className="font-display font-bold text-[30px] sm:text-[36px] md:text-[42px] tracking-[-0.03em]"
          style={{
            color: '#14151A',
            lineHeight: 1.05,
          }}
        >
          Creators we track
        </h1>
        <p className="text-[15px] text-muted mt-2 max-w-xl">
          We follow the most insightful finance YouTubers and surface every stock call they make.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {data.map(creator => (
          <div
            key={creator.slug}
            className="bg-white flex flex-col gap-4"
            style={{ borderRadius: 18, padding: 22, border: '1px solid #ECEBE4' }}
          >
            {/* Creator header */}
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate(`/creators/${creator.slug}`)}
                className="shrink-0 transition-transform duration-150 hover:scale-105"
                title={`View ${creator.name}'s profile`}
              >
                {creator.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.name}
                    className="rounded-full"
                    style={{ width: 52, height: 52 }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-full text-white"
                    style={{
                      width: 52,
                      height: 52,
                      background: creator.brandColor,
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 700,
                      fontSize: 20,
                    }}
                  >
                    {creator.initial}
                  </div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/creators/${creator.slug}`)}
                  className="text-left hover:text-accent transition-colors duration-150"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    color: '#14151A',
                    lineHeight: 1.2,
                  }}
                >
                  {creator.name}
                </button>
                <p className="text-[12px] text-muted mt-0.5">
                  {creator.handle} · {fmtSubs(creator.subscribers)} subscribers
                </p>
              </div>
              <a
                href={creator.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[12px] font-semibold px-3 py-1.5 border border-[#ECEBE4] rounded-[8px] text-muted hover:text-primary hover:border-[#D6D5CC] transition-colors duration-150"
                onClick={e => e.stopPropagation()}
              >
                Visit ↗
              </a>
            </div>

            {/* Bio */}
            <p style={{ fontSize: 13.5, color: '#6E6F78', lineHeight: 1.6 }}>{creator.bio}</p>

            {/* Stat tiles */}
            <div className="flex items-center gap-2">
              <div
                className="flex flex-col gap-0.5 px-3 py-2"
                style={{ background: '#F8F8F4', borderRadius: 11 }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Videos tracked
                </span>
                <span className="text-[16px] font-bold text-primary">{creator.videosTracked}</span>
              </div>
              <div
                className="flex flex-col gap-0.5 px-3 py-2"
                style={{ background: '#F8F8F4', borderRadius: 11 }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Bullish calls
                </span>
                <span
                  className="text-[16px] font-bold"
                  style={{ color: '#0F9D63' }}
                >
                  {creator.bullishPct.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Recent calls */}
            {creator.recentCalls && creator.recentCalls.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  Recent calls
                </h3>
                {creator.recentCalls.slice(0, 3).map(call => (
                  <div key={call.videoId} className="flex items-start gap-2">
                    {/* Mini thumbnail — clicking opens summary modal */}
                    <button
                      onClick={() => onSummaryClick(call.videoId)}
                      className="relative shrink-0 overflow-hidden"
                      style={{
                        width: 66,
                        height: 37,
                        borderRadius: 6,
                        background: creator.brandColor,
                        display: 'block',
                      }}
                    >
                      {call.thumbnailUrl && (
                        <img
                          src={call.thumbnailUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(20,21,26,0.35)' }}
                      >
                        <Play size={12} color="white" fill="white" />
                      </div>
                      {call.durationSeconds != null && (
                        <span
                          className="absolute bottom-1 right-1 text-white"
                          style={{
                            fontSize: 9,
                            fontFamily: '"JetBrains Mono", monospace',
                            background: 'rgba(20,21,26,0.75)',
                            borderRadius: 3,
                            padding: '1px 3px',
                          }}
                        >
                          {fmtDuration(call.durationSeconds)}
                        </span>
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={() => onSummaryClick(call.videoId)}
                          className="text-[12px] font-semibold text-primary hover:text-accent transition-colors duration-150 line-clamp-1 flex-1 text-left"
                        >
                          {call.videoTitle}
                        </button>
                        <span className="text-[10px] text-faint shrink-0">{fmtRelDate(call.publishedAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {call.mentions.slice(0, 3).map(m => (
                          <StockChip
                            key={m.ticker}
                            ticker={m.ticker}
                            sentiment={m.sentiment}
                            stockId={m.stockId}
                          />
                        ))}
                        <button
                          onClick={() => onSummaryClick(call.videoId)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-150"
                          style={{ background: '#F3F2EC', color: '#6E6F78' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#E8E7E0')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F3F2EC')}
                        >
                          Summary ↗
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
