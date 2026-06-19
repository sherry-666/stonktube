import { useNavigate } from 'react-router-dom'
import SentimentIcon from './SentimentIcon.js'

interface StockChipProps {
  ticker: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  stockId: string
}

export default function StockChip({ ticker, sentiment }: StockChipProps) {
  const navigate = useNavigate()

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    navigate(`/stocks/${ticker}`)
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
      style={{
        background: '#F3F2EC',
        border: '1px solid #ECEBE4',
        borderRadius: 7,
        padding: '3px 8px',
        fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 600,
        fontSize: 12,
        color: '#14151A',
        lineHeight: 1.4,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = '#ECEBE2'
        el.style.borderColor = '#D6D5CC'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = '#F3F2EC'
        el.style.borderColor = '#ECEBE4'
      }}
    >
      {ticker}
      <SentimentIcon sentiment={sentiment} size={11} />
    </button>
  )
}
