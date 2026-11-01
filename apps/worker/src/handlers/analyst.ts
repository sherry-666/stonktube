import type { Job } from 'bullmq'
import { Stock } from '@stonktube/db'
import type { FillAnalystJob } from '@stonktube/shared'
import pino from 'pino'
import { fillStockAnalyst } from '../lib/analyst-fill.js'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

export async function handleFillAnalyst(job: Job<FillAnalystJob>) {
  const { stockId } = job.data

  const stocks = stockId
    ? await Stock.find({ _id: stockId, isPrivate: false }, 'ticker priceSymbol')
    : await Stock.find({ isPrivate: false }, 'ticker priceSymbol')

  let filled = 0
  for (const stock of stocks) {
    try {
      if (await fillStockAnalyst(stock)) filled++
    } catch (err) {
      log.warn({ ticker: stock.ticker, err: (err as Error).message }, 'Analyst fill failed for ticker — skipping')
    }
  }
  log.info({ filled, total: stocks.length }, 'Analyst data filled')
}
