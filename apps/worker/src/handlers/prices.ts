import type { Job } from 'bullmq'
import mongoose from 'mongoose'
import { Stock, insertPrices } from '@stonktube/db'
import { rollupQueue } from '@stonktube/pipeline'
import type { FillPricesJob } from '@stonktube/shared'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function latestPriceDate(stockId: mongoose.Types.ObjectId): Promise<Date | null> {
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')
  const doc = await db.collection('pricepoints')
    .findOne({ 'meta.stockId': stockId }, { sort: { date: -1 } })
  return doc ? (doc.date as Date) : null
}

async function fillOne(stock: { _id: mongoose.Types.ObjectId; ticker: string }) {
  const latest = await latestPriceDate(stock._id)
  const fromDate = latest
    ? new Date(latest.getTime() + 86_400_000)
    : new Date(Date.now() - 365 * 86_400_000)
  const toDate = new Date()

  if (fromDate > toDate) {
    log.info({ ticker: stock.ticker }, 'Prices already up to date')
    return 0
  }

  type Bar = { date: Date; close: number }
  const bars: Bar[] = (await yahooFinance.historical(stock.ticker, {
    period1: fromDate.toISOString().slice(0, 10),
    period2: toDate.toISOString().slice(0, 10),
    interval: '1d',
  })) as Bar[]

  if (!bars || bars.length === 0) return 0

  await insertPrices(
    bars.map(b => ({
      date: b.date,
      meta: { stockId: stock._id, ticker: stock.ticker },
      close: b.close,
      source: 'yahoo',
    })),
  )

  log.info({ ticker: stock.ticker, inserted: bars.length }, 'Prices inserted')
  return bars.length
}

export async function handleFillPrices(job: Job<FillPricesJob>) {
  const { stockId } = job.data

  const stocks = stockId
    ? await Stock.find({ _id: stockId, isPrivate: false })
    : await Stock.find({ isPrivate: false })

  let total = 0
  for (const stock of stocks) {
    try {
      total += await fillOne(stock)
    } catch (err) {
      log.warn({ ticker: stock.ticker, err: (err as Error).message }, 'Price fill failed for ticker — skipping')
    }
  }

  if (total > 0) {
    for (const s of stocks) {
      await rollupQueue.add('rollup', { stockId: s._id.toString() }, { jobId: `rollup-${s._id}-post-prices` })
    }
  }
}
