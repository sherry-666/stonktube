/**
 * One-off, queue-free price fill. Fetches Yahoo Finance daily closes for every
 * non-private stock (or specific tickers passed as args) and upserts them,
 * using priceSymbol when the display ticker isn't a Yahoo symbol (SPX -> ^GSPC).
 * A stock with a split we haven't applied yet gets its prices rebuilt.
 *
 *   node dist/fill-prices-direct.js            # all non-private stocks
 *   node dist/fill-prices-direct.js SPX SPACEX # only these
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Stock, rebuildStats } from '@stonktube/db'
import pino from 'pino'
import { fillStockPrices } from './lib/price-fill.js'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

await connectDB()

const tickers = process.argv.slice(2).map((t) => t.toUpperCase())
const filter = tickers.length > 0 ? { ticker: { $in: tickers } } : { isPrivate: false }
const stocks = await Stock.find(filter)

for (const stock of stocks) {
  const symbol = stock.priceSymbol || stock.ticker
  try {
    const { inserted, rebuilt } = await fillStockPrices(stock)
    if (inserted === 0) log.warn({ ticker: stock.ticker, symbol }, 'no new bars returned')
    else log.info({ ticker: stock.ticker, symbol, inserted, rebuilt }, 'filled')
    if (rebuilt) await rebuildStats(stock._id.toString())
  } catch (err) {
    log.warn({ ticker: stock.ticker, symbol, err: (err as Error).message }, 'fill failed — skipping')
  }
}

await disconnectDB()
