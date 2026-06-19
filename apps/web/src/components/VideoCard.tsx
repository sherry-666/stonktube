import { FileText, Play } from 'lucide-react'
import StockChip from './StockChip.js'
import { fmtDuration, fmtRelDate } from '../utils/format.js'

export interface VideoCardDTO {
  id: string
  title: string
  url: string
  thumbnailUrl?: string
  publishedAt: string
  durationSeconds?: number
  creator: {
    name: string
    handle: string
    brandColor: string
    initial: string
    avatarUrl?: string
    slug: string
  }
  primaryTicker: string
  thumbBg: string
  mentions: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
}

interface VideoCardProps {
  video: VideoCardDTO
  onSummaryClick: (id: string) => void
}

export default function VideoCard({ video, onSummaryClick }: VideoCardProps) {
  const { creator, mentions } = video
  const visibleMentions = mentions.slice(0, 5)

  return (
    <div
      className="flex gap-[14px] p-[14px] bg-white border border-[#ECEBE4] rounded-card transition-colors duration-150"
      style={{ borderRadius: 14 }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#D6D5CC')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#ECEBE4')}
    >
      {/* Thumbnail */}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 relative overflow-hidden"
        style={{
          width: 176,
          height: 99,
          borderRadius: 10,
          background: video.thumbBg,
          display: 'block',
        }}
        onClick={e => e.stopPropagation()}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(20,21,26,0.45) 0%, rgba(20,21,26,0.05) 60%)',
          }}
        />
        {/* Primary ticker top-left */}
        <span
          className="absolute top-[8px] left-[10px]"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            fontSize: 27,
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1,
          }}
        >
          {video.primaryTicker}
        </span>
        {/* Creator name bottom-left */}
        <span
          className="absolute bottom-[8px] left-[10px]"
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.85)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          {creator.name}
        </span>
        {/* Play button center */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(20,21,26,0.7)',
            }}
          >
            <Play size={14} color="white" fill="white" />
          </div>
        </div>
        {/* Duration badge bottom-right */}
        {video.durationSeconds != null && (
          <span
            className="absolute bottom-[8px] right-[8px] px-[5px] py-[2px] text-white"
            style={{
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 500,
              background: 'rgba(20,21,26,0.88)',
              borderRadius: 4,
            }}
          >
            {fmtDuration(video.durationSeconds)}
          </span>
        )}
      </a>

      {/* Right column */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
        {/* Creator row */}
        <div className="flex items-center gap-2">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt={creator.name}
              className="rounded-full shrink-0"
              style={{ width: 26, height: 26 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full shrink-0 text-white font-bold"
              style={{
                width: 26,
                height: 26,
                background: creator.brandColor,
                fontSize: 11,
              }}
            >
              {creator.initial}
            </div>
          )}
          <span className="text-[13px] text-muted truncate">
            <span className="font-semibold text-body">{creator.name}</span>
            {' · '}
            {fmtRelDate(video.publishedAt)}
          </span>
        </div>

        {/* Title */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-semibold text-primary leading-snug hover:text-accent transition-colors duration-150 line-clamp-2"
          onClick={e => e.stopPropagation()}
        >
          {video.title}
        </a>

        {/* Bottom row */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {visibleMentions.map(m => (
              <StockChip
                key={m.ticker}
                ticker={m.ticker}
                sentiment={m.sentiment}
                stockId={m.stockId}
              />
            ))}
          </div>
          <button
            onClick={e => {
              e.stopPropagation()
              onSummaryClick(video.id)
            }}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold transition-colors duration-150"
            style={{ color: '#4F46E5' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#3730A3')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#4F46E5')}
          >
            <FileText size={13} />
            View full summary
          </button>
        </div>
      </div>
    </div>
  )
}
