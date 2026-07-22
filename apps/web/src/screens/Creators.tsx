import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useCreators } from '../api/hooks.js'
import StockChip from '../components/StockChip.js'
import { fmtSubs, fmtRelDate, fmtDuration } from '../utils/format.js'
import { useLang, useLangNavigate } from '../hooks/useLang.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

interface CreatorsProps {
  onSummaryClick: (id: string) => void
}

export default function Creators({ onSummaryClick }: CreatorsProps) {
  const { t } = useTranslation()
  const { lang } = useLang()
  const { data, isLoading, error } = useCreators(lang)
  const navigate = useLangNavigate()
  usePageMeta('YouTube Finance Creators & Influencers · StonkTube', 'Discover YouTube finance creators, influencers, and crypto YouTubers. See which stocks and crypto they cover and track their sentiment ratings.')

  if (isLoading) {
    return <div className="py-12 text-center text-muted text-sm">{t('creators.loading')}</div>
  }

  if (error || !data) {
    return <div className="py-12 text-center text-bear text-sm">{t('creators.error')}</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1
          className="font-display font-bold text-[30px] sm:text-[36px] md:text-[42px] tracking-[-0.03em]"
          style={{
            color: '#14151A',
            lineHeight: 1.05,
          }}
        >
          {t('creators.title')}
        </h1>
        <p className="text-[15px] text-muted mt-2 max-w-xl">
          {t('creators.description')}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {data.map(creator => (
          <CreatorCard key={creator.slug} creator={creator} onSummaryClick={onSummaryClick} />
        ))}
      </div>
    </div>
  )
}

function CreatorCard({ creator, onSummaryClick }: { creator: import('../api/hooks.js').CreatorCard; onSummaryClick: (id: string) => void }) {
  const { t } = useTranslation()
  const navigate = useLangNavigate()
  const [hovered, setHovered] = useState(false)

  return (
          <div
            className="flex flex-col gap-4 cursor-pointer"
            onClick={() => navigate(`/creators/${creator.slug}`)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              borderRadius: 18,
              padding: 22,
              border: '1px solid #ECEBE4',
              background: hovered
                ? `linear-gradient(135deg, ${creator.brandColor}18 0%, #ffffff 55%)`
                : '#ffffff',
              transition: 'background 0.2s ease',
            }}
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
                  {creator.handle} · {fmtSubs(creator.subscribers)} {t('creators.subscribers')}
                </p>
              </div>
              <a
                href={creator.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[12px] font-semibold px-3 py-1.5 border border-[#ECEBE4] rounded-[8px] text-muted hover:text-primary hover:border-[#D6D5CC] transition-colors duration-150"
                onClick={e => e.stopPropagation()}
              >
                {t('creators.visit')}
              </a>
            </div>

            {/* Bio */}
            <p style={{ fontSize: 13.5, color: '#6E6F78', lineHeight: 1.6 }}>{creator.bio}</p>

            {/* Stat tiles + Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="flex flex-col gap-0.5 px-3 py-2"
                style={{ background: '#F8F8F4', borderRadius: 11 }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {t('creators.videos_tracked')}
                </span>
                <span className="text-[16px] font-bold text-primary">{creator.videosTracked}</span>
              </div>
              <div
                className="flex flex-col gap-0.5 px-3 py-2"
                style={{ background: '#F8F8F4', borderRadius: 11 }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {t('creators.bullish_calls')}
                </span>
                <span
                  className="text-[16px] font-bold"
                  style={{ color: '#0F9D63' }}
                >
                  {creator.bullishPct.toFixed(0)}%
                </span>
              </div>
              {creator.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full self-center"
                  style={{ background: '#F3F2EC', color: '#6E6F78' }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Recent calls */}
            {creator.recentCalls && creator.recentCalls.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {t('creators.recent_calls')}
                </h3>
                {creator.recentCalls.slice(0, 3).map(call => (
                  <div key={call.videoId} className="flex items-start gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); onSummaryClick(call.videoId) }}
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

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); onSummaryClick(call.videoId) }}
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
                          onClick={e => { e.stopPropagation(); onSummaryClick(call.videoId) }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-150"
                          style={{ background: '#F3F2EC', color: '#6E6F78' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#E8E7E0')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F3F2EC')}
                        >
                          {t('creators.summary_btn')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  )
}
