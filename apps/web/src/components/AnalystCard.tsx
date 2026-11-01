import { useTranslation } from 'react-i18next'
import type { AnalystAction, StockAnalyst } from '../api/hooks.js'
import { fmtDate, fmtPct, fmtPrice } from '../utils/format.js'

const BUY_COLOR = '#0F9D63'
const HOLD_COLOR = '#D9B26A'
const SELL_COLOR = '#E5484D'
const MONO = '"JetBrains Mono", monospace'

const CONSENSUS_COLORS: Record<string, string> = {
  strong_buy: BUY_COLOR,
  buy: BUY_COLOR,
  hold: HOLD_COLOR,
  underperform: SELL_COLOR,
  sell: SELL_COLOR,
}

function pctOf(value: number, lo: number, hi: number): number {
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo || 1)) * 100))
}

function TargetRange({ low, high, mean, current, currency }: {
  low: number
  high: number
  mean: number
  current?: number
  currency: string
}) {
  const { t } = useTranslation()
  // A price outside the analysts' range still has to fit on the bar.
  const lo = Math.min(low, current ?? low)
  const hi = Math.max(high, current ?? high)
  return (
    <div>
      <div className="relative" style={{ height: 6, marginTop: 10 }}>
        <div className="absolute inset-0" style={{ background: '#F3F2EC', borderRadius: 3 }} />
        <div
          className="absolute"
          style={{
            left: `${pctOf(low, lo, hi)}%`,
            right: `${100 - pctOf(high, lo, hi)}%`,
            top: 0,
            bottom: 0,
            background: '#D6D5CC',
            borderRadius: 3,
          }}
        />
        <div
          className="absolute rounded-full"
          title={t('analyst.average_target')}
          style={{
            left: `${pctOf(mean, lo, hi)}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            background: '#4F46E5',
            border: '2px solid white',
          }}
        />
        {current != null && (
          <div
            className="absolute"
            title={t('analyst.current_price')}
            style={{
              left: `${pctOf(current, lo, hi)}%`,
              top: -4,
              bottom: -4,
              width: 2,
              transform: 'translateX(-50%)',
              background: '#14151A',
            }}
          />
        )}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-muted">
        <span>{t('analyst.low')} <span style={{ fontFamily: MONO }}>{fmtPrice(low, currency)}</span></span>
        <span>{t('analyst.high')} <span style={{ fontFamily: MONO }}>{fmtPrice(high, currency)}</span></span>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action?: string }) {
  const { t } = useTranslation()
  const style =
    action === 'up' ? { background: '#E7F6EF', color: BUY_COLOR }
    : action === 'down' ? { background: '#FCEBEB', color: SELL_COLOR }
    : action === 'init' ? { background: '#F3F2EC', color: '#6E6F78' }
    : null
  if (!style) return null
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={style}>
      {t(`analyst.action_${action}`)}
    </span>
  )
}

function ActionRow({ action, currency }: { action: AnalystAction; currency: string }) {
  const changed = action.priorPriceTarget != null && action.priorPriceTarget !== action.priceTarget
  return (
    <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: '1px solid #F3F2EC' }}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-primary truncate">{action.firm}</span>
          <ActionBadge action={action.action} />
        </div>
        <div className="text-[11px] text-muted">{fmtDate(action.date)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-semibold text-primary">{action.toGrade}</div>
        {action.priceTarget != null && (
          <div className="text-[11px] text-muted" style={{ fontFamily: MONO }}>
            {changed && <>{fmtPrice(action.priorPriceTarget, currency)} → </>}
            {fmtPrice(action.priceTarget, currency)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalystCard({ analyst, currency, currentPrice }: {
  analyst: StockAnalyst
  currency: string
  currentPrice?: number
}) {
  const { t } = useTranslation()
  const buy = analyst.strongBuy + analyst.buy
  const sell = analyst.sell + analyst.strongSell
  const totalRatings = buy + analyst.hold + sell
  const consensusColor = CONSENSUS_COLORS[analyst.recommendationKey ?? ''] ?? '#14151A'
  const { targetMean, targetLow, targetHigh, upsidePct } = analyst
  const hasActions = analyst.actions.length > 0

  return (
    <div className="bg-white border border-[#ECEBE4] p-5" style={{ borderRadius: 18 }}>
      <h2
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: '-0.015em',
          color: '#14151A',
        }}
      >
        {t('analyst.title')}
      </h2>
      <p className="text-[12px] text-muted mt-0.5 mb-4">
        {t('analyst.source', { date: fmtDate(analyst.fetchedAt) })}
      </p>

      <div className={`grid grid-cols-1 gap-7 ${hasActions ? 'sm:grid-cols-[1fr_1.2fr]' : ''}`}>
        <div className="flex flex-col gap-5 min-w-0">
          {totalRatings > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-muted">{t('analyst.consensus')}</span>
                {analyst.recommendationKey && (
                  <span
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 700,
                      fontSize: 22,
                      color: consensusColor,
                    }}
                  >
                    {t(`analyst.rating_${analyst.recommendationKey}`, analyst.recommendationKey)}
                  </span>
                )}
              </div>
              <div className="flex overflow-hidden mt-2" style={{ height: 8, borderRadius: 5 }}>
                <div style={{ width: `${(buy / totalRatings) * 100}%`, background: BUY_COLOR }} />
                <div style={{ width: `${(analyst.hold / totalRatings) * 100}%`, background: HOLD_COLOR }} />
                <div style={{ width: `${(sell / totalRatings) * 100}%`, background: SELL_COLOR }} />
              </div>
              <div className="flex justify-between mt-2 text-[12px]">
                <span style={{ color: BUY_COLOR }}>{t('analyst.buy')} {buy}</span>
                <span style={{ color: '#8A6D3B' }}>{t('analyst.hold')} {analyst.hold}</span>
                <span style={{ color: SELL_COLOR }}>{t('analyst.sell')} {sell}</span>
              </div>
            </div>
          )}

          {targetMean != null && (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-muted">
                  {t('analyst.average_target')}
                  {analyst.targetAnalysts != null && ` · ${t('analyst.analyst_count', { count: analyst.targetAnalysts })}`}
                </span>
                <span className="shrink-0">
                  <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 18, color: '#14151A' }}>
                    {fmtPrice(targetMean, currency)}
                  </span>
                  {upsidePct != null && (
                    <span
                      className="text-[12px] font-semibold ml-1.5"
                      style={{ color: upsidePct >= 0 ? BUY_COLOR : SELL_COLOR }}
                    >
                      {fmtPct(upsidePct)}
                    </span>
                  )}
                </span>
              </div>
              {targetLow != null && targetHigh != null && (
                <TargetRange
                  low={targetLow}
                  high={targetHigh}
                  mean={targetMean}
                  current={currentPrice}
                  currency={currency}
                />
              )}
            </div>
          )}
        </div>

        {hasActions && (
          <div className="min-w-0">
            <div className="text-[12px] text-muted mb-1">{t('analyst.recent_actions')}</div>
            {analyst.actions.map(action => (
              <ActionRow key={action.firm} action={action} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
