import type { Job } from 'bullmq'
import { Stock } from '@stonktube/db'
import { rollupQueue } from '@stonktube/pipeline'
import type { FillPricesJob } from '@stonktube/shared'
import pino from 'pino'
import { fillStockPrices } from '../lib/price-fill.js'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

export async function handleFillPrices(job: Job<FillPricesJob>) {
  const { stockId } = job.data

  const stocks = stockId
    ? await Stock.find({ _id: stockId, isPrivate: false })
    : await Stock.find({ isPrivate: false })

  let total = 0
  const rebuiltIds: string[] = []
  for (const stock of stocks) {
    try {
      const { inserted, rebuilt } = await fillStockPrices(stock)
      total += inserted
      if (rebuilt) rebuiltIds.push(stock._id.toString())
    } catch (err) {
      log.warn({ ticker: stock.ticker, err: (err as Error).message }, 'Price fill failed for ticker — skipping')
    }
  }

  if (total > 0) {
    for (const s of stocks) {
      await rollupQueue.add('rollup', { stockId: s._id.toString() }, { jobId: `rollup-${s._id}-post-prices` })
    }
  }
  // Unique job IDs: the fixed ID above is ignored while a completed job with the
  // same ID is retained, and a rebuild must always correct stats and mention prices.
  for (const id of rebuiltIds) {
    await rollupQueue.add('rollup', { stockId: id }, { jobId: `rollup-${id}-post-split-${Date.now()}` })
  }
}
