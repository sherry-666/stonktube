import type { Types } from 'mongoose'
import { getPrices, insertPrices, deletePricesForStock } from '@stonktube/db'
import YahooFinance from 'yahoo-finance2'
import pino from 'pino'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

// Normal Yahoo revisions stay well inside this; a split never does.
const PRICE_TOLERANCE = 0.02
// Bars checked before a split. Requiring two mismatches ignores a single stored
// day that differs from Yahoo for an unrelated reason.
const PRE_SPLIT_BARS = 5
const MIN_PRE_SPLIT_MISMATCHES = 2
// A rebuild replaces the stored series, so Yahoo must still cover nearly all of
// it. A low overlap can mean the symbol was reassigned or lost its history.
const MIN_REBUILD_COVERAGE = 0.9

export type StockRef = { _id: Types.ObjectId; ticker: string; priceSymbol?: string }
export type YahooBar = { date: Date; day: string; close: number }
export type YahooSplit = { day: string; numerator: number; denominator: number }

export type PricePlan = {
  stored: Map<string, number>
  bars: YahooBar[]
  splits: YahooSplit[]
  staleSplits: YahooSplit[]
  // Share of stored days that Yahoo still returns.
  coverage: number
  action: 'rebuild' | 'append' | 'none'
  // Bars to insert: the whole Yahoo series for a rebuild, otherwise new days only.
  toInsert: YahooBar[]
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function fetchYahooPrices(symbol: string, period1: string) {
  type Chart = {
    quotes?: { date: Date; close: number | null }[]
    events?: { splits?: { date: Date; numerator: number; denominator: number }[] }
  }
  // Use chart() rather than historical(): historical() throws when Yahoo returns
  // any null closes (e.g. VIX), chart() just returns them so we filter.
  const chart = (await yahooFinance.chart(
    symbol,
    { period1, period2: dayKey(new Date()), interval: '1d', events: 'split' },
    { validateResult: false },
  )) as unknown as Chart
  // Skip today's bar: crypto and Asian markets open at or just after 00:00 UTC, so
  // it can still be in progress, and a stored close is never corrected afterwards.
  const today = dayKey(new Date())
  const bars: YahooBar[] = (chart.quotes ?? [])
    .filter((q) => q.close != null && dayKey(q.date) < today)
    .map((q) => ({ date: q.date, day: dayKey(q.date), close: q.close as number }))
  const splits: YahooSplit[] = (chart.events?.splits ?? []).map((s) => ({
    day: dayKey(s.date),
    numerator: s.numerator,
    denominator: s.denominator,
  }))
  return { bars, splits }
}

// A split is stale when Yahoo's adjusted closes just before it no longer match
// what we stored, which means our earlier days are still on the pre-split basis.
export function findStaleSplits(
  stored: Map<string, number>,
  bars: YahooBar[],
  splits: YahooSplit[],
): YahooSplit[] {
  return splits.filter((split) => {
    const compared = bars
      .filter((b) => b.day < split.day && stored.has(b.day) && b.close !== 0)
      .slice(-PRE_SPLIT_BARS)
    const mismatches = compared.filter(
      (b) => Math.abs((stored.get(b.day) as number) / b.close - 1) > PRICE_TOLERANCE,
    )
    return mismatches.length >= Math.min(MIN_PRE_SPLIT_MISMATCHES, compared.length) && mismatches.length > 0
  })
}

export async function planPriceFill(stock: StockRef): Promise<PricePlan> {
  // Display ticker (e.g. SPX) isn't always the Yahoo symbol (e.g. ^GSPC).
  const symbol = stock.priceSymbol || stock.ticker
  const points = await getPrices(stock._id, new Date(0))
  const stored = new Map(points.map((p) => [dayKey(p.date), p.close]))
  const days = [...stored.keys()]
  const firstDay = days[0] ?? dayKey(new Date(Date.now() - 365 * 86_400_000))
  const lastDay = days[days.length - 1]

  // Always fetch the full stored range: split adjustments rewrite past closes,
  // so comparing them is how a split we haven't applied yet gets detected.
  const { bars, splits } = await fetchYahooPrices(symbol, firstDay)
  const staleSplits = findStaleSplits(stored, bars, splits)
  const overlap = bars.filter((b) => stored.has(b.day)).length
  const coverage = stored.size > 0 ? overlap / stored.size : 1

  if (staleSplits.length > 0 && coverage >= MIN_REBUILD_COVERAGE) {
    return { stored, bars, splits, staleSplits, coverage, action: 'rebuild', toInsert: bars }
  }
  if (staleSplits.length > 0) {
    log.warn({ ticker: stock.ticker, symbol, coverage }, 'Stale split found but Yahoo history is too short to rebuild')
  }
  // Compare by calendar day: a stored bar's time of day can differ from Yahoo's.
  const toInsert = bars.filter((b) => !lastDay || b.day > lastDay)
  return {
    stored,
    bars,
    splits,
    staleSplits,
    coverage,
    action: toInsert.length > 0 ? 'append' : 'none',
    toInsert,
  }
}

export async function applyPricePlan(stock: StockRef, plan: PricePlan): Promise<void> {
  if (plan.action === 'none') return
  // Time-series collection: insert-only, so a rebuild deletes and re-inserts.
  if (plan.action === 'rebuild') await deletePricesForStock(stock._id)
  await insertPrices(
    plan.toInsert.map((b) => ({
      date: b.date,
      meta: { stockId: stock._id, ticker: stock.ticker },
      close: b.close,
      source: 'yahoo',
    })),
  )
}

export async function fillStockPrices(stock: StockRef): Promise<{ inserted: number; rebuilt: boolean }> {
  const plan = await planPriceFill(stock)
  await applyPricePlan(stock, plan)
  const rebuilt = plan.action === 'rebuild'
  if (rebuilt) {
    log.warn(
      { ticker: stock.ticker, splits: plan.staleSplits, previousDays: plan.stored.size, newDays: plan.toInsert.length },
      'Rebuilt prices after a split',
    )
  } else if (plan.toInsert.length > 0) {
    log.info({ ticker: stock.ticker, inserted: plan.toInsert.length }, 'Prices inserted')
  }
  return { inserted: plan.toInsert.length, rebuilt }
}
