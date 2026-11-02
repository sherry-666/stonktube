import type { Types } from 'mongoose'
import { AnalystSnapshot, Stock } from '@stonktube/db'
import type { AnalystAction, StockAnalyst } from '@stonktube/shared'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const MAX_ACTIONS = 10
const ACTION_WINDOW_MS = 365 * 86_400_000

export type StockRef = { _id: Types.ObjectId; ticker: string; priceSymbol?: string }

type RawHistoryRow = {
  firm?: string
  toGrade?: string
  fromGrade?: string
  action?: string
  currentPriceTarget?: number
  priorPriceTarget?: number
  epochGradeDate?: Date | string
}

export type RawAnalystSummary = {
  financialData?: {
    targetMeanPrice?: number
    targetHighPrice?: number
    targetLowPrice?: number
    numberOfAnalystOpinions?: number
    recommendationKey?: string
  }
  recommendationTrend?: {
    trend?: {
      period?: string
      strongBuy?: number
      buy?: number
      hold?: number
      sell?: number
      strongSell?: number
    }[]
  }
  upgradeDowngradeHistory?: { history?: RawHistoryRow[] }
}

// Yahoo reports a missing price target as 0.
function positive(n?: number): number | undefined {
  return n != null && n > 0 ? n : undefined
}

// Each firm's newest action in the window, newest first. Older ratings are left
// out rather than shown as if the firm still held them.
function latestActionPerFirm(history: RawHistoryRow[], now: Date): AnalystAction[] {
  const byFirm = new Map<string, AnalystAction>()
  for (const row of history) {
    if (!row.firm || !row.toGrade || !row.epochGradeDate) continue
    const date = new Date(row.epochGradeDate)
    if (now.getTime() - date.getTime() > ACTION_WINDOW_MS) continue
    const seen = byFirm.get(row.firm)
    if (seen && seen.date >= date) continue
    byFirm.set(row.firm, {
      firm: row.firm,
      toGrade: row.toGrade,
      fromGrade: row.fromGrade || undefined,
      action: row.action,
      priceTarget: positive(row.currentPriceTarget),
      priorPriceTarget: positive(row.priorPriceTarget),
      date,
    })
  }
  return [...byFirm.values()].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, MAX_ACTIONS)
}

// Null when Yahoo has no analyst coverage to show.
export function parseAnalystSummary(summary: RawAnalystSummary, now = new Date()): StockAnalyst | null {
  const fin = summary.financialData ?? {}
  const trend = summary.recommendationTrend?.trend?.find((t) => t.period === '0m')
  const actions = latestActionPerFirm(summary.upgradeDowngradeHistory?.history ?? [], now)
  const ratings = {
    strongBuy: trend?.strongBuy ?? 0,
    buy: trend?.buy ?? 0,
    hold: trend?.hold ?? 0,
    sell: trend?.sell ?? 0,
    strongSell: trend?.strongSell ?? 0,
  }
  const targetMean = positive(fin.targetMeanPrice)
  const totalRatings = Object.values(ratings).reduce((sum, n) => sum + n, 0)
  if (targetMean == null && totalRatings === 0 && actions.length === 0) return null

  return {
    targetMean,
    targetHigh: positive(fin.targetHighPrice),
    targetLow: positive(fin.targetLowPrice),
    targetAnalysts: fin.numberOfAnalystOpinions,
    recommendationKey: fin.recommendationKey && fin.recommendationKey !== 'none' ? fin.recommendationKey : undefined,
    ...ratings,
    actions,
    fetchedAt: now,
  }
}

export async function fetchAnalystData(symbol: string): Promise<StockAnalyst | null> {
  // Crypto and indices have no analyst coverage, so don't ask.
  if (symbol.endsWith('-USD') || symbol.startsWith('^')) return null
  try {
    const summary = await yahooFinance.quoteSummary(
      symbol,
      { modules: ['financialData', 'recommendationTrend', 'upgradeDowngradeHistory'] },
      { validateResult: false },
    )
    return parseAnalystSummary(summary as unknown as RawAnalystSummary)
  } catch (err) {
    // Yahoo's answer for ETFs and other symbols without fundamentals.
    if (/No fundamentals data/i.test((err as Error).message)) return null
    throw err
  }
}

// Keeps the previous data when Yahoo has none: the API hides it once it goes stale.
export async function fillStockAnalyst(stock: StockRef): Promise<boolean> {
  const analyst = await fetchAnalystData(stock.priceSymbol || stock.ticker)
  if (!analyst) return false
  await Stock.updateOne({ _id: stock._id }, { $set: { analyst } })
  // Re-runs on the same UTC day overwrite that day's snapshot, leaving one per day.
  const { actions: _actions, ...consensus } = analyst
  await AnalystSnapshot.updateOne(
    { stockId: stock._id, day: analyst.fetchedAt.toISOString().slice(0, 10) },
    { $set: { ticker: stock.ticker, ...consensus } },
    { upsert: true },
  )
  return true
}
