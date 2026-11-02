/**
 * Rebuilds prices for stocks whose stored history predates a split, using real
 * Yahoo Finance closes, then re-runs their rollup. Dry run by default: nothing
 * is written unless --apply is passed. Stocks that don't need a rebuild, or that
 * Yahoo no longer covers, are always skipped.
 *
 * --apply first saves the stored prices to split-backfill-backup-<time>.json at
 * the repo root, because the rebuild deletes them.
 *
 *   node dist/backfill-split-prices.js --prod                # dry run, MONGODB_URI_PROD
 *   node dist/backfill-split-prices.js --prod --apply        # write
 *   node dist/backfill-split-prices.js --prod --apply CRWD   # only these tickers
 */
import { config } from 'dotenv'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: resolve(repoRoot, '.env') })

import mongoose from 'mongoose'
import { connectDB, disconnectDB, Stock, rebuildStats } from '@stonktube/db'
import { planPriceFill, applyPricePlan, findStaleSplits } from './lib/price-fill.js'
import type { PricePlan, StockRef } from './lib/price-fill.js'

// Found by audit-splits. PARA is excluded: Yahoo hasn't adjusted its history yet.
const DEFAULT_TICKERS = ['CRWD', '8035.T', 'SOXS', '196170.KQ', 'SPGI']

const args = process.argv.slice(2)
const useProd = args.includes('--prod')
const apply = args.includes('--apply')
const requested = args.filter((a) => !a.startsWith('--')).map((t) => t.toUpperCase())
const tickers = requested.length > 0 ? requested : DEFAULT_TICKERS

function describe(stock: StockRef, plan: PricePlan) {
  const lastSplit = plan.staleSplits[plan.staleSplits.length - 1]
  const preSplit = lastSplit ? plan.bars.filter((b) => b.day < lastSplit.day).slice(-1)[0] : undefined
  return {
    ticker: stock.ticker,
    action: plan.action === 'rebuild' ? 'REBUILD' : 'SKIP',
    storedDays: plan.stored.size,
    firstStored: [...plan.stored.keys()][0],
    yahooBars: plan.bars.length,
    coverage: Number(plan.coverage.toFixed(3)),
    staleSplits: plan.staleSplits.map((s) => `${s.day} ${s.numerator}:${s.denominator}`),
    preSplitSample: preSplit && {
      day: preSplit.day,
      stored: plan.stored.get(preSplit.day),
      yahoo: preSplit.close,
    },
  }
}

const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI
if (!uri) throw new Error(`${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'} is not set`)
// The dry run must not write anything, including indexes for the models.
mongoose.set('autoIndex', false)
mongoose.set('autoCreate', false)
await connectDB(uri)
console.log(
  `${apply ? 'APPLY' : 'DRY RUN'} on database "${mongoose.connection.db?.databaseName}" ` +
    `(${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'})`,
)

const stocks: StockRef[] = await Stock.find({ ticker: { $in: tickers } })
const missing = tickers.filter((t) => !stocks.some((s) => s.ticker === t))
if (missing.length > 0) console.log(`Not found: ${missing.join(', ')}`)

const plans: { stock: StockRef; plan: PricePlan }[] = []
for (const stock of stocks) {
  const plan = await planPriceFill(stock)
  plans.push({ stock, plan })
  console.log(JSON.stringify(describe(stock, plan)))
}
const rebuilds = plans.filter((p) => p.plan.action === 'rebuild')
console.log(`${rebuilds.length} of ${plans.length} stocks would be rebuilt`)

if (apply && rebuilds.length > 0) {
  const backup = resolve(repoRoot, `split-backfill-backup-${Date.now()}.json`)
  writeFileSync(
    backup,
    JSON.stringify(rebuilds.map(({ stock, plan }) => ({ ticker: stock.ticker, closes: [...plan.stored] }))),
  )
  console.log(`Backup of stored prices: ${backup}`)

  for (const { stock, plan } of rebuilds) {
    await applyPricePlan(stock, plan)
    await rebuildStats(stock._id.toString())
    const after = await planPriceFill(stock)
    const stillStale = findStaleSplits(after.stored, after.bars, after.splits).length
    console.log(JSON.stringify({ ticker: stock.ticker, rebuiltDays: after.stored.size, stillStale }))
  }
}

await disconnectDB()
