import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Play, Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVideo } from '../api/hooks.js'
import SentimentIcon from './SentimentIcon.js'
import StockChip from './StockChip.js'
import { fmtDate, fmtDuration } from '../utils/format.js'
import { SENTIMENT_META } from '@stonktube/shared'
import { useLang } from '../hooks/useLang.js'

interface VideoSummaryModalProps {
  videoId: string | null
  onClose: () => void
}

export default function VideoSummaryModal({ videoId, onClose }: VideoSummaryModalProps) {
  const { t } = useTranslation()
  const { lang } = useLang()
  const { data: video, isLoading } = useVideo(videoId, lang)
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!videoId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(20,21,26,0.5)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative bg-white overflow-y-auto w-full"
        style={{
          borderRadius: 20,
          maxWidth: 560,
          maxHeight: '88vh',
          boxShadow: '0 30px 80px -20px rgba(20,21,26,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {isLoading || !video ? (
          <div className="flex items-center justify-center p-12 text-muted text-sm">
            {isLoading ? t('video.loading') : t('video.not_found')}
          </div>
        ) : (
          <>
            {/* Header banner */}
            <div
              className="relative overflow-hidden"
              style={{ height: 188, background: video.creator.brandColor }}
            >
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(20,21,26,0.2) 0%, rgba(20,21,26,0.7) 100%)' }}
              />
              {/* Primary ticker */}
              <span
                className="absolute bottom-6 left-6"
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 700,
                  fontSize: 46,
                  color: 'white',
                  lineHeight: 1,
                }}
              >
                {video.primaryTicker}
              </span>
              {/* Duration badge top-right */}
              {video.durationSeconds != null && (
                <span
                  className="absolute top-4 right-14 px-2 py-1 text-white"
                  style={{
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                    background: 'rgba(20,21,26,0.7)',
                    borderRadius: 5,
                  }}
                >
                  {fmtDuration(video.durationSeconds)}
                </span>
              )}
              {/* Play button center */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center"
                onClick={e => e.stopPropagation()}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(20,21,26,0.6)',
                    border: '2px solid rgba(255,255,255,0.4)',
                  }}
                >
                  <Play size={20} color="white" fill="white" />
                </div>
              </a>
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 flex items-center justify-center transition-colors duration-150"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(20,21,26,0.5)',
                  color: 'white',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,21,26,0.8)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,21,26,0.5)')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-5">
              {/* Creator row */}
              <div className="flex items-center gap-3">
                {video.creator.avatarUrl ? (
                  <img
                    src={video.creator.avatarUrl}
                    alt={video.creator.name}
                    className="rounded-full shrink-0"
                    style={{ width: 40, height: 40 }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-full shrink-0 text-white font-bold"
                    style={{
                      width: 40,
                      height: 40,
                      background: video.creator.brandColor,
                      fontSize: 15,
                    }}
                  >
                    {video.creator.initial}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[14px] text-primary">{video.creator.name}</div>
                  <div className="text-[12px] text-muted">
                    {video.creator.handle} · {fmtDate(video.publishedAt)}
                  </div>
                </div>
              </div>

              {/* Title */}
              <h2
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: 22,
                  color: '#14151A',
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                }}
              >
                {video.title}
              </h2>

              {/* Summary */}
              {video.summary && (
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-widest text-faint mb-2">
                    {t('video.summary')}
                  </h3>
                  <p className="text-[14px] text-body leading-relaxed">{video.summary}</p>
                </div>
              )}

              {/* Key takeaways */}
              {video.mentions && video.mentions.length > 0 && (
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-widest text-faint mb-3">
                    {t('video.key_takeaways')}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {video.mentions.map(m => {
                      const meta = SENTIMENT_META[m.sentiment]
                      return (
                        <button
                          key={m.ticker}
                          onClick={() => {
                            onClose()
                            navigate(`/stocks/${m.ticker}`)
                          }}
                          className="flex items-start gap-3 p-3 rounded-[10px] text-left transition-colors duration-150 w-full"
                          style={{ background: '#F8F8F4' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F0EFE8')}
                          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F8F8F4')}
                        >
                          <StockChip ticker={m.ticker} sentiment={m.sentiment} stockId={m.stockId} />
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 600 }}
                          >
                            <SentimentIcon sentiment={m.sentiment} size={11} color={meta.color} />
                            {t(`sentiment.${m.sentiment.toLowerCase()}`)}
                          </div>
                          {m.note && (
                            <span className="text-[13px] text-body flex-1 leading-snug">{m.note}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Watch on YouTube */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-[10px] text-white font-semibold text-[14px] transition-opacity duration-150 hover:opacity-90"
                style={{ background: '#14151A' }}
                onClick={e => e.stopPropagation()}
              >
                <Youtube size={18} />
                {t('video.watch_full')}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
