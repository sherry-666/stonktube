/**
 * One-off, queue-free price fill. Fetches Yahoo Finance daily closes for every
 * non-private stock (or specific tickers passed as args) and upserts them,
 * using priceSymbol when the display ticker isn't a Yahoo symbol (SPX -> ^GSPC).
 *
 *   node dist/fill-prices-direct.js            # all non-private stocks
 *   node dist/fill-prices-direct.js SPX SPACEX # only these
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose from 'mongoose'
import { connectDB, disconnectDB, Stock, insertPrices } from '@stonktube/db'
import YahooFinance from 'yahoo-finance2'
import pino from 'pino'

const yahooFinance = new YahooFinance()
const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function latestPriceDate(stockId: mongoose.Types.ObjectId): Promise<Date | null> {
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')
  const doc = await db.collection('pricepoints').findOne({ 'meta.stockId': stockId }, { sort: { date: -1 } })
  return doc ? (doc.date as Date) : null
}

await connectDB()

const tickers = process.argv.slice(2).map((t) => t.toUpperCase())
const filter = tickers.length > 0 ? { ticker: { $in: tickers } } : { isPrivate: false }
const stocks = await Stock.find(filter)

for (const stock of stocks) {
  const symbol = stock.priceSymbol || stock.ticker
  try {
    const latest = await latestPriceDate(stock._id as mongoose.Types.ObjectId)
    const fromDate = latest
      ? new Date(latest.getTime() + 86_400_000)
      : new Date(Date.now() - 365 * 86_400_000)
    const toDate = new Date()
    if (fromDate > toDate) {
      log.info({ ticker: stock.ticker }, 'already up to date')
      continue
    }

    const bars = (await yahooFinance.historical(symbol, {
      period1: fromDate.toISOString().slice(0, 10),
      period2: toDate.toISOString().slice(0, 10),
      interval: '1d',
    })) as { date: Date; close: number }[]

    // Time-series collection: insert-only. Keep only bars after the latest
    // stored day (and with a real close) so we never duplicate existing points.
    const valid = (bars ?? []).filter((b) => b.close != null && (!latest || b.date > latest))
    if (valid.length === 0) {
      log.warn({ ticker: stock.ticker, symbol }, 'no new bars returned')
      continue
    }

    await insertPrices(
      valid.map((b) => ({
        date: b.date,
        meta: { stockId: stock._id as mongoose.Types.ObjectId, ticker: stock.ticker },
        close: b.close,
        source: 'yahoo',
      })),
    )
    log.info({ ticker: stock.ticker, symbol, inserted: valid.length }, 'filled')
  } catch (err) {
    log.warn({ ticker: stock.ticker, symbol, err: (err as Error).message }, 'fill failed — skipping')
  }
}

await disconnectDB()
