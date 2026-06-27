import { Play } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCreator } from '../api/hooks.js'
import StockChip from '../components/StockChip.js'
import SentimentBar from '../components/SentimentBar.js'
import { fmtSubs, fmtRelDate, fmtDuration } from '../utils/format.js'
import { bullishPctToVerdict } from '@stonktube/shared'

interface CreatorProfileProps {
  onSummaryClick: (id: string) => void
}

export default function CreatorProfile({ onSummaryClick }: CreatorProfileProps) {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { data: creator, isLoading, error } = useCreator(slug)

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">Loading…</div>
  }

  if (error || !creator) {
    return <div className="py-12 text-center text-bear text-sm">Failed to load creator.</div>
  }

  const verdict = bullishPctToVerdict(creator.bullishPct)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/creators')}
        className="flex items-center gap-1 text-[13px] font-medium text-muted hover:text-primary transition-colors duration-150 self-start"
      >
        ‹ Creators
      </button>

      {/* Header card */}
      <div className="bg-white" style={{ borderRadius: 18, padding: 22, border: '1px solid #ECEBE4' }}>
        <div className="flex items-start gap-4">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt={creator.name}
              className="rounded-full shrink-0"
              style={{ width: 72, height: 72 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full shrink-0 text-white"
              style={{
                width: 72,
                height: 72,
                background: creator.brandColor,
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 28,
              }}
            >
              {creator.initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-bold tracking-[-0.02em]"
              style={{ color: '#14151A', fontSize: 28, lineHeight: 1.1 }}
            >
              {creator.name}
            </h1>
            <p className="text-[13px] text-muted mt-1">
              {creator.handle} · {fmtSubs(creator.subscribers)} subscribers
            </p>
            {creator.bio && (
              <p className="mt-3" style={{ fontSize: 13.5, color: '#6E6F78', lineHeight: 1.6 }}>
                {creator.bio}
              </p>
            )}
          </div>
          <a
            href={creator.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-semibold px-3 py-1.5 border border-[#ECEBE4] rounded-[8px] text-muted hover:text-primary hover:border-[#D6D5CC] transition-colors duration-150"
          >
            Visit channel ↗
          </a>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          <div className="flex flex-col gap-0.5 px-3 py-2.5" style={{ background: '#F8F8F4', borderRadius: 11 }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Videos tracked</span>
            <span className="text-[18px] font-bold text-primary">{creator.videosTracked}</span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2.5" style={{ background: '#F8F8F4', borderRadius: 11 }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Bullish calls</span>
            <span className="text-[18px] font-bold" style={{ color: '#0F9D63' }}>
              {creator.bullishPct.toFixed(0)}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2.5" style={{ background: '#F8F8F4', borderRadius: 11 }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Stocks covered</span>
            <span className="text-[18px] font-bold text-primary">{creator.covers.length}</span>
          </div>
        </div>

        {/* Sentiment breakdown */}
        {creator.bullCount + creator.neutralCount + creator.bearCount > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Sentiment across all calls
              </span>
              <span className="text-[12px] font-semibold" style={{ color: '#0F9D63' }}>
                {verdict}
              </span>
            </div>
            <SentimentBar
              bullCount={creator.bullCount}
              neutralCount={creator.neutralCount}
              bearCount={creator.bearCount}
            />
          </div>
        )}

        {/* Covered tickers */}
        {creator.covers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint mb-2">Covers</h3>
            <div className="flex flex-wrap gap-1.5">
              {creator.covers.map(c => (
                <StockChip key={c.ticker} ticker={c.ticker} sentiment={c.sentiment} stockId={c.stockId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All calls */}
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
          Recent calls
        </h2>
        {creator.calls.length === 0 ? (
          <p className="text-[13px] text-muted">No analyzed videos yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {creator.calls.map(call => (
              <div
                key={call.videoId}
                className="bg-white border border-[#ECEBE4] p-4 transition-colors duration-150"
                style={{ borderRadius: 14 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#D6D5CC')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#ECEBE4')}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail — opens summary */}
                  <button
                    onClick={() => onSummaryClick(call.videoId)}
                    className="relative shrink-0 overflow-hidden"
                    style={{
                      width: 104,
                      height: 58,
                      borderRadius: 8,
                      background: creator.brandColor,
                      display: 'block',
                    }}
                  >
                    {call.thumbnailUrl && (
                      <img src={call.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(20,21,26,0.35)' }}
                    >
                      <Play size={16} color="white" fill="white" />
                    </div>
                    {call.durationSeconds != null && (
                      <span
                        className="absolute bottom-1 right-1 text-white"
                        style={{
                          fontSize: 10,
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
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onSummaryClick(call.videoId)}
                        className="text-[14px] font-semibold text-primary hover:text-accent transition-colors duration-150 leading-snug text-left"
                      >
                        {call.videoTitle}
                      </button>
                      <span className="text-[11px] text-faint shrink-0 mt-0.5">{fmtRelDate(call.publishedAt)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {call.mentions.slice(0, 5).map(m => (
                        <StockChip key={m.ticker} ticker={m.ticker} sentiment={m.sentiment} stockId={m.stockId} />
                      ))}
                      <button
                        onClick={() => onSummaryClick(call.videoId)}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors duration-150"
                        style={{ background: '#F3F2EC', color: '#6E6F78' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E8E7E0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F3F2EC')}
                      >
                        Summary ↗
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
