/**
 * READ-ONLY audit of stock splits / reverse splits in stored prices. Compares
 * each stock's `pricepoints` and `priceAtMention` values with Yahoo's current
 * split-adjusted closes, and writes split-audit-result.json at the repo root.
 *
 * Deliberately uses the raw driver with only find() and does not import
 * @stonktube/db: registering its models could create indexes on connect.
 *
 *   node dist/audit-splits.js --self-test      # no DB, checks detection on NFLX
 *   node dist/audit-splits.js --prod           # uses MONGODB_URI_PROD
 *   node dist/audit-splits.js                  # uses MONGODB_URI
 *   node dist/audit-splits.js --prod NVDA TSLA # only these tickers
 */
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: resolve(repoRoot, '.env') })

import mongoose from 'mongoose'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// Normal Yahoo revisions stay well inside this; a split never does.
const PRICE_TOLERANCE = 0.02
const JUMP_THRESHOLD = 0.25
// Looser for priceAtMention, whose "on or before publishedAt" day can differ by
// one trading day depending on the bar's timestamp.
const MENTION_TOLERANCE = 0.2

type Split = { date: string; numerator: number; denominator: number }
type Quote = { day: string; close: number }
type Segment = { from: string; to: string; storedOverYahoo: number; days: number }
type Jump = { from: string; to: string; before: number; after: number; ratio: number }

function dayKey(date: Date | string | number): string {
  return new Date(date).toISOString().slice(0, 10)
}

function round(n: number, digits = 3): number {
  return Number(n.toFixed(digits))
}

async function fetchYahoo(symbol: string, firstDay: string): Promise<{ quotes: Quote[]; splits: Split[] }> {
  type Chart = {
    quotes?: { date: Date; close: number | null }[]
    events?: { splits?: { date: Date; numerator: number; denominator: number }[] }
  }
  const load = () =>
    yahooFinance.chart(
      symbol,
      { period1: firstDay, interval: '1d', events: 'split' },
      { validateResult: false },
    ) as unknown as Promise<Chart>
  // Rate limiting is usually transient, so retry once before reporting an error.
  const chart = await load().catch(async () => {
    await new Promise((r) => setTimeout(r, 3000))
    return load()
  })
  return {
    quotes: (chart.quotes ?? [])
      .filter((q) => q.close != null)
      .map((q) => ({ day: dayKey(q.date), close: q.close as number })),
    splits: (chart.events?.splits ?? []).map((s) => ({
      date: dayKey(s.date),
      numerator: s.numerator,
      denominator: s.denominator,
    })),
  }
}

function comparePrices(stored: Map<string, number>, quotes: Quote[]) {
  let compared = 0
  let mismatched = 0
  // Runs of consecutive days with the same stored/Yahoo ratio. Stale prices
  // before a split show up as one long run at the split's ratio.
  const segments: Segment[] = []
  for (const q of quotes) {
    const close = stored.get(q.day)
    if (close == null || q.close === 0) continue
    compared++
    const ratio = close / q.close
    const isMismatch = Math.abs(ratio - 1) > PRICE_TOLERANCE
    if (isMismatch) mismatched++
    const current = segments[segments.length - 1]
    const currentIsMismatch = current && Math.abs(current.storedOverYahoo - 1) > PRICE_TOLERANCE
    if (
      current &&
      currentIsMismatch === isMismatch &&
      (!isMismatch || Math.abs(ratio / current.storedOverYahoo - 1) <= PRICE_TOLERANCE)
    ) {
      current.to = q.day
      current.days++
    } else {
      segments.push({ from: q.day, to: q.day, storedOverYahoo: round(ratio), days: 1 })
    }
  }
  return {
    compared,
    mismatched,
    mismatchSegments: segments.filter((s) => Math.abs(s.storedOverYahoo - 1) > PRICE_TOLERANCE),
  }
}

function findJumps(stored: Map<string, number>): Jump[] {
  const days = [...stored.keys()].sort()
  const jumps: Jump[] = []
  for (let i = 1; i < days.length; i++) {
    const before = stored.get(days[i - 1]) as number
    const after = stored.get(days[i]) as number
    if (before > 0 && Math.abs(after / before - 1) > JUMP_THRESHOLD) {
      jumps.push({ from: days[i - 1], to: days[i], before, after, ratio: round(after / before) })
    }
  }
  return jumps
}

function closeOnOrBefore(quotes: Quote[], day: string): number | undefined {
  let close: number | undefined
  for (const q of quotes) {
    if (q.day > day) break
    close = q.close
  }
  return close
}

// Offline check that a split in real Yahoo data is detected: NFLX split 10:1 on
// 2025-11-17, so multiplying earlier closes by 10 mimics prices stored pre-split.
async function selfTest(): Promise<void> {
  const { quotes, splits } = await fetchYahoo('NFLX', '2025-10-01')
  const stale = new Map(quotes.map((q) => [q.day, q.day < '2025-11-17' ? q.close * 10 : q.close]))
  const clean = new Map(quotes.map((q) => [q.day, q.close]))
  const staleResult = comparePrices(stale, quotes)
  const cleanResult = comparePrices(clean, quotes)
  const jumps = findJumps(stale)
  console.log(JSON.stringify({ splits, stale: staleResult, jumps, clean: cleanResult }, null, 2))
  const ok =
    splits.some((s) => s.date === '2025-11-17' && s.numerator === 10 && s.denominator === 1) &&
    staleResult.mismatchSegments.length === 1 &&
    staleResult.mismatchSegments[0].storedOverYahoo === 10 &&
    jumps.length === 1 &&
    cleanResult.mismatched === 0
  console.log(ok ? 'SELF-TEST PASSED' : 'SELF-TEST FAILED')
  if (!ok) process.exitCode = 1
}

async function audit(useProd: boolean, tickers: string[]): Promise<void> {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI
  if (!uri) throw new Error(`${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'} is not set`)
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')
  console.log(`Auditing database "${db.databaseName}" (${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'})`)

  const filter = tickers.length > 0 ? { ticker: { $in: tickers } } : { isPrivate: { $ne: true } }
  const stocks = await db
    .collection('stocks')
    .find(filter, { projection: { ticker: 1, priceSymbol: 1 } })
    .toArray()

  const results: Record<string, unknown>[] = []
  let next = 0
  const auditNext = async () => {
    while (next < stocks.length) {
      const stock = stocks[next++]
      const symbol: string = stock.priceSymbol || stock.ticker
      const points = await db
        .collection('pricepoints')
        .find({ 'meta.stockId': stock._id }, { projection: { date: 1, close: 1 } })
        .sort({ date: 1 })
        .toArray()
      const stored = new Map<string, number>(points.map((p) => [dayKey(p.date), p.close as number]))
      const days = [...stored.keys()]
      const base = { ticker: stock.ticker as string, symbol, storedDays: days.length, first: days[0], last: days[days.length - 1] }
      if (days.length === 0) {
        results.push({ ...base, status: 'NO_PRICES' })
        continue
      }
      try {
        const { quotes, splits } = await fetchYahoo(symbol, days[0])
        const videos = await db
          .collection('videos')
          .find(
            { 'mentions.stockId': stock._id, 'mentions.priceAtMention': { $exists: true } },
            { projection: { publishedAt: 1, 'mentions.stockId': 1, 'mentions.priceAtMention': 1 } },
          )
          .toArray()
        const staleMentions: { videoId: string; publishedAt: string; priceAtMention: number; yahooClose: number }[] = []
        for (const video of videos) {
          for (const mention of video.mentions as { stockId: mongoose.Types.ObjectId; priceAtMention?: number }[]) {
            if (!mention.stockId.equals(stock._id) || mention.priceAtMention == null) continue
            const yahooClose = closeOnOrBefore(quotes, dayKey(video.publishedAt))
            if (yahooClose && Math.abs(mention.priceAtMention / yahooClose - 1) > MENTION_TOLERANCE) {
              staleMentions.push({
                videoId: video._id.toString(),
                publishedAt: dayKey(video.publishedAt),
                priceAtMention: mention.priceAtMention,
                yahooClose: round(yahooClose, 2),
              })
            }
          }
        }
        const prices = comparePrices(stored, quotes)
        const jumps = findJumps(stored)
        const flagged = splits.length > 0 || prices.mismatched > 0 || jumps.length > 0 || staleMentions.length > 0
        results.push({
          ...base,
          status: flagged ? 'FLAGGED' : 'OK',
          splits,
          ...prices,
          jumps,
          staleMentionCount: staleMentions.length,
          staleMentions: staleMentions.slice(0, 20),
        })
      } catch (err) {
        results.push({ ...base, status: 'ERROR', error: (err as Error).message.slice(0, 200) })
      }
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  await Promise.all([auditNext(), auditNext(), auditNext(), auditNext()])
  await mongoose.disconnect()

  results.sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)))
  const withStatus = (status: string) => results.filter((r) => r.status === status)
  const out = resolve(repoRoot, 'split-audit-result.json')
  writeFileSync(out, JSON.stringify(results, null, 2))

  console.log(
    `stocks=${results.length} ok=${withStatus('OK').length} flagged=${withStatus('FLAGGED').length} ` +
      `noPrices=${withStatus('NO_PRICES').length} errors=${withStatus('ERROR').length}`,
  )
  for (const r of withStatus('FLAGGED')) console.log(JSON.stringify(r))
  for (const r of withStatus('ERROR')) console.log(JSON.stringify(r))
  console.log(`Full results: ${out}`)
}

const args = process.argv.slice(2)
if (args.includes('--self-test')) {
  await selfTest()
} else {
  const tickers = args.filter((a) => !a.startsWith('--')).map((t) => t.toUpperCase())
  await audit(args.includes('--prod'), tickers)
}
