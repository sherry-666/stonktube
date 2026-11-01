/**
 * Fixes stocks whose Yahoo symbol points at the wrong security or at nothing.
 * DRY RUN by default: it reads the DB and Yahoo, prints the plan, and writes
 * nothing. Prices come only from Yahoo; a fix is blocked if Yahoo's security for
 * the new symbol isn't the expected one, so no price is ever guessed.
 *
 *   node dist/fix-security-mappings.js                 # dry run on MONGODB_URI
 *   node dist/fix-security-mappings.js USDC SATS       # only these tickers
 *   node dist/fix-security-mappings.js --prod          # dry run on MONGODB_URI_PROD
 *   node dist/fix-security-mappings.js --prod --apply  # writes to production
 *
 * Lists the videos that need re-analysis but never runs it (see REANALYZE below).
 *
 * Safe to re-run: work already done is detected and skipped. Avoid running
 * --apply across the hourly price fill, which could add bars while a stock's
 * prices are being replaced.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose, { Types } from 'mongoose'
import { insertPrices, deletePricesForStock, rebuildStats } from '@stonktube/db'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const PRICE_TOLERANCE = 0.02
// Share of stored days that must agree with the new symbol to keep stored prices.
const KEEP_MIN_MATCH = 0.85
// Above this, a replacement has already happened (Yahoo revises a few closes).
const REPLACED_MIN_MATCH = 0.98
// Look back past the first mention so it has a close on or before its date.
const LOOKBACK_DAYS = 7
const DEFAULT_HISTORY_DAYS = 365
const DAY_MS = 86_400_000

interface Remap {
  kind: 'remap'
  ticker: string
  symbol: string
  /** Yahoo's name for `symbol` must match, or the fix is blocked. */
  expect: RegExp
  /** replace: stored prices belong to another security. keep: same security. */
  prices: 'replace' | 'keep'
  name?: string
  sector?: string
}

interface MarkPrivate {
  kind: 'private'
  ticker: string
  name?: string
  aliases?: string[]
}

interface Merge {
  kind: 'merge'
  ticker: string
  into: string
  expect: RegExp
  /** The stored prices belong to another security, so don't compare them with `into`. */
  pricesDiffer?: boolean
}

/** Deletes a record nobody should be tracking, blocked if it has mentions unless told to remove them. */
interface Retire {
  kind: 'retire'
  ticker: string
  removeMentions?: boolean
  /** Tracked stock that takes over the symbol, so the LLM's ticker still resolves. */
  aliasOn?: string
}

/**
 * Mentions on one record that mean different things, which only re-reading the
 * transcript can sort out. Lists the videos, and writes nothing unless
 * `retireWhenEmpty` is set and re-analysis left the record with no mentions.
 */
interface Reanalyze {
  kind: 'reanalyze'
  ticker: string
  retireWhenEmpty?: boolean
}

type Fix = Remap | MarkPrivate | Merge | Retire | Reanalyze

const crypto = (ticker: string, symbol: string, expect: RegExp, name?: string): Remap => ({
  kind: 'remap', ticker, symbol, expect, prices: 'replace', name, sector: name ? 'Cryptocurrency' : undefined,
})
const replace = (ticker: string, symbol: string, expect: RegExp, name?: string): Remap => ({
  kind: 'remap', ticker, symbol, expect, prices: 'replace', name,
})
const keep = (ticker: string, symbol: string, expect: RegExp, name?: string): Remap => ({
  kind: 'remap', ticker, symbol, expect, prices: 'keep', name,
})

const FIXES: Fix[] = [
  // Stored prices belong to a different security.
  crypto('USDC', 'USDC-USD', /^USDC/, 'USD Coin'),
  replace('SATS', 'ECHO', /EchoStar/),
  replace('EUR-USD', 'EURUSD=X', /^EUR\/USD/, 'Euro'),
  replace('JPY', 'JPYUSD=X', /^JPY\/USD/, 'Japanese Yen'),
  crypto('XRP', 'XRP-USD', /^XRP/, 'XRP'),
  crypto('LUNA', 'LUNA20314-USD', /^Terra USD/, 'Terra'),
  replace('CATL', '300750.SZ', /Contemporary Amperex/),
  // No stored prices: the bare symbol is empty on Yahoo.
  crypto('ADA', 'ADA-USD', /^Cardano/, 'Cardano'),
  crypto('BNB', 'BNB-USD', /^BNB/),
  crypto('LDO', 'LDO-USD', /^Lido/),
  crypto('WLD', 'WLD-USD', /^Worldcoin/),
  crypto('XMR', 'XMR-USD', /^Monero/),
  crypto('ZEC', 'ZEC-USD', /^Zcash/),
  // Not WLFI-USD, an unrelated token Yahoo lists as "wlfi.club".
  crypto('WLFI', 'WLFI33251-USD', /^World Liberty Financial USD/),
  replace('DXY', 'DX-Y.NYB', /US Dollar Index/),
  replace('XAG', 'SI=F', /^Silver/),
  replace('XPT', 'PL=F', /^Platinum/),
  replace('XPD', 'PA=F', /^Palladium/, 'Palladium'),
  // Quoted against USD so the chart rises when the currency strengthens.
  replace('CNY', 'CNYUSD=X', /^CNY\/USD/, 'Chinese Yuan'),
  replace('KRW', 'KRWUSD=X', /^KRW\/USD/),
  replace('GBP', 'GBPUSD=X', /^GBP\/USD/, 'British Pound'),
  replace('MTK', '2454.TW', /MediaTek/, 'MediaTek Inc.'),
  replace('HTC', '2498.TW', /HTC/, 'HTC Corporation'),
  // Stored prices are right; only the symbol that refreshes them is dead.
  keep('NDX', '^NDX', /NASDAQ-100/),
  keep('028300.KS', '028300.KQ', /HLB/, 'HLB Co., Ltd.'),
  keep('064290.KS', '064290.KQ', /INTEKPLUS/i, 'Intekplus Co., Ltd.'),
  keep('GETY', 'GETYQ', /Getty Images/),
  // Private companies that Yahoo's symbol lookup matched to unrelated stocks.
  { kind: 'private', ticker: 'ANTH', name: 'Anthropic', aliases: ['Anthropic'] },
  { kind: 'private', ticker: 'MNSH', name: 'Moonshot AI', aliases: ['Moonshot'] },
  { kind: 'private', ticker: 'XAI' },
  // Never tradable on Yahoo under these symbols, but creators do discuss them.
  { kind: 'private', ticker: 'FTX', name: 'FTX' },
  { kind: 'private', ticker: 'WGM' },
  // Same company on the wrong exchange suffix, duplicating 036930.KQ.
  { kind: 'merge', ticker: '036930.KS', into: '036930.KQ', expect: /JUSUNG/ },
  // Mentions mean Paramount, now Skydance; stored prices are Banzai/Parabolic.
  { kind: 'merge', ticker: 'PARA', into: 'SKYD', expect: /Skydance/, pricesDiffer: true },
  // TRX Gold has no mentions, and Tron is tracked as TRX-USD.
  { kind: 'retire', ticker: 'TRX', aliasOn: 'TRX-USD' },
  // A regulator, not a security.
  { kind: 'retire', ticker: 'SEC', removeMentions: true },
  // No mentions and no usable prices. A later mention recreates the right stock.
  ...['ARS', 'ASKJ', 'BNG', 'FLE', 'JPQ', 'SVB', 'TAO', 'TPW', '093230.KQ'].map(
    (ticker): Retire => ({ kind: 'retire', ticker }),
  ),
  { kind: 'reanalyze', ticker: 'USD' },
  { kind: 'reanalyze', ticker: 'AI' },
  { kind: 'reanalyze', ticker: 'UST', retireWhenEmpty: true },
]

type Bar = { day: string; date: Date; close: number }

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const useProd = args.includes('--prod')
const only = args.filter((a) => !a.startsWith('--')).map((t) => t.toUpperCase())

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function yahooName(symbol: string): Promise<string | undefined> {
  const quote = (await yahooFinance.quote(symbol, {}, { validateResult: false })) as
    | { regularMarketPrice?: number; shortName?: string; longName?: string }
    | undefined
  if (!quote?.regularMarketPrice) return undefined
  return quote.longName ?? quote.shortName
}

async function fetchBars(symbol: string, from: Date): Promise<Bar[]> {
  const chart = (await yahooFinance.chart(
    symbol,
    { period1: dayKey(from), period2: dayKey(new Date()), interval: '1d' },
    { validateResult: false },
  )) as unknown as { quotes?: { date: Date; close: number | null }[] }
  return (chart.quotes ?? [])
    .filter((q) => q.close != null)
    .map((q) => ({ day: dayKey(q.date), date: q.date, close: q.close as number }))
}

/** Close on or before `date`; bars are oldest-first. */
function closeOnOrBefore(bars: Bar[], date: Date): number | undefined {
  let close: number | undefined
  for (const bar of bars) {
    if (bar.date > date) break
    close = bar.close
  }
  return close
}

const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI
if (!uri) throw new Error(`${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'} is not set`)
// No index or collection creation: a dry run must leave the DB untouched.
await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
const db = mongoose.connection.db
if (!db) throw new Error('DB not connected')
const stocksColl = db.collection('stocks')
const videosColl = db.collection('videos')
const pricesColl = db.collection('pricepoints')

console.log(`${apply ? 'APPLYING to' : 'DRY RUN on'} database "${db.databaseName}" (${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'})\n`)

async function storedPrices(stockId: Types.ObjectId): Promise<Map<string, number>> {
  const docs = await pricesColl.find({ 'meta.stockId': stockId }, { projection: { date: 1, close: 1 } }).sort({ date: 1 }).toArray()
  return new Map(docs.map((p) => [dayKey(p.date as Date), p.close as number]))
}

function matchShare(stored: Map<string, number>, bars: Bar[]): number {
  if (stored.size === 0) return 0
  let matched = 0
  for (const bar of bars) {
    const close = stored.get(bar.day)
    if (close != null && bar.close !== 0 && Math.abs(close / bar.close - 1) <= PRICE_TOLERANCE) matched++
  }
  return matched / stored.size
}

async function mentionVideos(stockId: Types.ObjectId) {
  return videosColl
    .find({ 'mentions.stockId': stockId }, { projection: { publishedAt: 1, mentions: 1 } })
    .sort({ publishedAt: 1 })
    .toArray()
}

type MentionDoc = { stockId: Types.ObjectId; priceAtMention?: number }

function mentionOf(video: Record<string, unknown>, stockId: Types.ObjectId): MentionDoc | undefined {
  return (video.mentions as MentionDoc[]).find((m) => m.stockId.equals(stockId))
}

async function runRemap(fix: Remap): Promise<string> {
  const stock = await stocksColl.findOne({ ticker: fix.ticker })
  if (!stock) return 'MISSING: no stock with this ticker'
  if (await stocksColl.findOne({ ticker: fix.symbol })) return `BLOCKED: a stock with ticker ${fix.symbol} already exists`

  const actualName = await yahooName(fix.symbol)
  if (!actualName || !fix.expect.test(actualName)) {
    return `BLOCKED: Yahoo's ${fix.symbol} is "${actualName ?? 'no quote'}", expected ${fix.expect}`
  }

  const stored = await storedPrices(stock._id)
  const videos = await mentionVideos(stock._id)
  const firstStored = [...stored.keys()][0]
  // At least the history a normal fill gives a new stock, and far enough back
  // to cover every stored day and mention.
  const from = new Date(
    Math.min(
      Date.now() - DEFAULT_HISTORY_DAYS * DAY_MS,
      ...(firstStored ? [new Date(firstStored).getTime() - LOOKBACK_DAYS * DAY_MS] : []),
      ...(videos[0] ? [new Date(videos[0].publishedAt).getTime() - LOOKBACK_DAYS * DAY_MS] : []),
    ),
  )
  const bars = await fetchBars(fix.symbol, from)
  if (bars.length === 0) return `BLOCKED: Yahoo returned no bars for ${fix.symbol}`

  const share = matchShare(stored, bars)
  const pct = `${Math.round(share * 100)}% of ${stored.size} stored days match ${fix.symbol}`
  if (fix.prices === 'keep' && share < KEEP_MIN_MATCH) return `BLOCKED: prices marked keep, but only ${pct}`
  const replacePrices = fix.prices === 'replace' && !(stored.size > 0 && share >= REPLACED_MIN_MATCH)

  const set: Record<string, unknown> = {}
  if (stock.priceSymbol !== fix.symbol) set.priceSymbol = fix.symbol
  if (fix.name && stock.name !== fix.name) set.name = fix.name
  if (fix.sector && stock.sector !== fix.sector) set.sector = fix.sector

  // rebuildStats only sees the latest 260 days, so older mentions are set here.
  const mentionWrites = replacePrices
    ? videos.flatMap((video) => {
        const close = closeOnOrBefore(bars, new Date(video.publishedAt))
        if (mentionOf(video, stock._id)?.priceAtMention === close) return []
        const update =
          close != null ? { $set: { 'mentions.$.priceAtMention': close } } : { $unset: { 'mentions.$.priceAtMention': '' } }
        return [{ updateOne: { filter: { _id: video._id, 'mentions.stockId': stock._id }, update } }]
      })
    : []

  const changes = Object.keys(set).length > 0 || replacePrices || mentionWrites.length > 0
  if (!changes) return `already done (${pct})`

  const summary =
    `${JSON.stringify(set)}; ` +
    (replacePrices ? `replace ${stored.size} stored days with ${bars.length} from ${fix.symbol}` : `keep prices, ${pct}`) +
    `; ${mentionWrites.length} of ${videos.length} mentions repriced`
  if (!apply) return `WOULD ${summary}`

  await stocksColl.updateOne(
    { _id: stock._id },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      $addToSet: { aliases: fix.symbol },
      // Translations of a wrong name are wrong too; the API falls back to `name`.
      ...(set.name ? { $unset: { translations: '' } } : {}),
    },
  )
  if (replacePrices) {
    await deletePricesForStock(stock._id)
    await insertPrices(
      bars.map((b) => ({ date: b.date, meta: { stockId: stock._id, ticker: fix.ticker }, close: b.close, source: 'yahoo' })),
    )
  }
  if (mentionWrites.length > 0) await videosColl.bulkWrite(mentionWrites)
  await rebuildStats(stock._id.toString())
  return `DONE ${summary}`
}

async function runPrivate(fix: MarkPrivate): Promise<string> {
  const stock = await stocksColl.findOne({ ticker: fix.ticker })
  if (!stock) return 'MISSING: no stock with this ticker'

  const storedDays = await pricesColl.countDocuments({ 'meta.stockId': stock._id })
  const videos = await mentionVideos(stock._id)
  const priced = videos.filter((v) => mentionOf(v, stock._id)?.priceAtMention != null)
  const rename = fix.name && stock.name !== fix.name
  const changes = stock.isPrivate !== true || rename || storedDays > 0 || priced.length > 0
  if (!changes) return 'already done'

  const summary = `mark private${rename ? `, rename "${stock.name}" to "${fix.name}"` : ''}; delete ${storedDays} stored days; clear ${priced.length} of ${videos.length} mention prices`
  if (!apply) return `WOULD ${summary}`

  await stocksColl.updateOne(
    { _id: stock._id },
    {
      $set: { isPrivate: true, ...(rename ? { name: fix.name } : {}) },
      ...(fix.aliases ? { $addToSet: { aliases: { $each: fix.aliases } } } : {}),
      ...(rename ? { $unset: { translations: '' } } : {}),
    },
  )
  await deletePricesForStock(stock._id)
  if (priced.length > 0) {
    await videosColl.bulkWrite(
      priced.map((video) => ({
        updateOne: {
          filter: { _id: video._id, 'mentions.stockId': stock._id },
          update: { $unset: { 'mentions.$.priceAtMention': '' } },
        },
      })),
    )
  }
  await rebuildStats(stock._id.toString())
  return `DONE ${summary}`
}

async function runMerge(fix: Merge): Promise<string> {
  const stock = await stocksColl.findOne({ ticker: fix.ticker })
  if (!stock) return 'already done (no such stock)'
  const target = await stocksColl.findOne({ ticker: fix.into })
  if (!target) return `BLOCKED: merge target ${fix.into} does not exist`

  const actualName = await yahooName(fix.into)
  if (!actualName || !fix.expect.test(actualName)) {
    return `BLOCKED: Yahoo's ${fix.into} is "${actualName ?? 'no quote'}", expected ${fix.expect}`
  }

  const stored = await storedPrices(stock._id)
  if (stored.size > 0 && !fix.pricesDiffer) {
    const bars = await fetchBars(fix.into, new Date(new Date([...stored.keys()][0]).getTime() - LOOKBACK_DAYS * DAY_MS))
    const share = matchShare(stored, bars)
    if (share < KEEP_MIN_MATCH) {
      return `BLOCKED: only ${Math.round(share * 100)}% of ${stored.size} stored days match ${fix.into}, so these may not be the same security`
    }
  }

  const videos = await mentionVideos(stock._id)
  const writes = videos.map((video) =>
    mentionOf(video, target._id)
      ? {
          updateOne: {
            filter: { _id: video._id },
            update: { $pull: { mentions: { stockId: stock._id } } },
          },
        }
      : {
          updateOne: {
            filter: { _id: video._id, 'mentions.stockId': stock._id },
            update: { $set: { 'mentions.$.stockId': target._id, 'mentions.$.ticker': fix.into } },
          },
        },
  )

  const duplicates = videos.filter((video) => mentionOf(video, target._id)).length
  const summary = `move ${videos.length - duplicates} mentions to ${fix.into}, drop ${duplicates} where it is already mentioned; delete ${stored.size} stored days and the ${fix.ticker} stock record`
  if (!apply) return `WOULD ${summary}`

  if (writes.length > 0) await videosColl.bulkWrite(writes as never)
  await stocksColl.updateOne({ _id: target._id }, { $addToSet: { aliases: fix.ticker } })
  await deletePricesForStock(stock._id)
  await stocksColl.deleteOne({ _id: stock._id })
  await rebuildStats(target._id.toString())
  return `DONE ${summary}`
}

async function runRetire(fix: Retire): Promise<string> {
  const stock = await stocksColl.findOne({ ticker: fix.ticker })
  if (!stock) return 'already done (no such stock)'
  const heir = fix.aliasOn ? await stocksColl.findOne({ ticker: fix.aliasOn }) : null
  if (fix.aliasOn && !heir) return `BLOCKED: ${fix.aliasOn} does not exist`

  const videos = await mentionVideos(stock._id)
  if (videos.length > 0 && !fix.removeMentions) return `BLOCKED: it has ${videos.length} mentions now`
  const storedDays = await pricesColl.countDocuments({ 'meta.stockId': stock._id })

  const summary = `delete "${stock.name}" and ${storedDays} stored days; remove ${videos.length} mentions${heir ? `; alias ${fix.ticker} on ${fix.aliasOn}` : ''}`
  if (!apply) return `WOULD ${summary}`

  if (heir) await stocksColl.updateOne({ _id: heir._id }, { $addToSet: { aliases: fix.ticker } })
  if (videos.length > 0) {
    await videosColl.updateMany({ 'mentions.stockId': stock._id }, { $pull: { mentions: { stockId: stock._id } } } as never)
  }
  await deletePricesForStock(stock._id)
  await stocksColl.deleteOne({ _id: stock._id })
  return `DONE ${summary}`
}

const reanalyzeIds = new Set<string>()

async function runReanalyze(fix: Reanalyze): Promise<string> {
  const stock = await stocksColl.findOne({ ticker: fix.ticker })
  if (!stock) return 'already done (no such stock)'
  const videos = await mentionVideos(stock._id)
  if (videos.length === 0) {
    return fix.retireWhenEmpty ? runRetire({ kind: 'retire', ticker: fix.ticker }) : 'no mentions left'
  }
  for (const video of videos) reanalyzeIds.add(video._id.toString())
  return `RE-ANALYZE ${videos.length} videos${fix.retireWhenEmpty ? ', then re-run this script to delete it if no mentions remain' : ''}`
}

const selected = only.length > 0 ? FIXES.filter((f) => only.includes(f.ticker)) : FIXES
const unknown = only.filter((t) => !FIXES.some((f) => f.ticker === t))
if (unknown.length > 0) console.log(`Not in the fix list, ignored: ${unknown.join(' ')}\n`)

let problems = 0
for (const fix of selected) {
  let result: string
  try {
    if (fix.kind === 'remap') result = await runRemap(fix)
    else if (fix.kind === 'private') result = await runPrivate(fix)
    else if (fix.kind === 'merge') result = await runMerge(fix)
    else if (fix.kind === 'retire') result = await runRetire(fix)
    else result = await runReanalyze(fix)
  } catch (err) {
    result = `FAILED: ${(err as Error).message}`
  }
  if (/^(BLOCKED|FAILED|MISSING)/.test(result)) problems++
  console.log(`${fix.ticker.padEnd(11)} ${result}`)
  await new Promise((r) => setTimeout(r, 150))
}

await mongoose.disconnect()
if (reanalyzeIds.size > 0) {
  console.log(`\nVideos to re-analyze with reanalyze-ids.js (${reanalyzeIds.size}):\n${[...reanalyzeIds].join(' ')}`)
}
console.log(`\n${selected.length} fixes, ${problems} blocked/failed/missing.${apply ? '' : ' Dry run: nothing was written.'}`)
if (problems > 0) process.exitCode = 1
