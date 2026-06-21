/**
 * Idempotent reference-data fix:
 *  - set the Yahoo price symbol for stocks whose display ticker differs from the
 *    Yahoo symbol (e.g. SPX is quoted as ^GSPC), so the price-fill job can find them
 *  - un-mark names that have since gone public (SpaceX → SPCX)
 *
 * Real metadata only — no fabricated videos or prices.
 *
 *   pnpm --filter @stonktube/db build
 *   node packages/db/dist/fix-symbols.js
 *
 * Afterwards run a price fill + rollup (or the scheduler) to populate prices/stats.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB } from './index.js'
import { Stock } from './models/Stock.js'

const FIXES: { ticker: string; set: Record<string, unknown> }[] = [
  { ticker: 'SPX', set: { priceSymbol: '^GSPC' } },
  { ticker: 'SPACEX', set: { priceSymbol: 'SPCX', isPrivate: false } },
  // Index tickers whose Yahoo symbol differs from the display ticker.
  { ticker: 'DJI', set: { priceSymbol: '^DJI' } },
  { ticker: 'NASDAQ', set: { priceSymbol: '^IXIC' } },
  { ticker: 'RUT', set: { priceSymbol: '^RUT' } },
  { ticker: 'RUA', set: { priceSymbol: '^RUA' } },
  { ticker: 'VIX', set: { priceSymbol: '^VIX' } },
  // SOX was auto-created against the wrong company ("Scanbox Asia Pacific").
  { ticker: 'SOX', set: { priceSymbol: '^SOX', name: 'PHLX Semiconductor Index', sector: 'Index' } },
]

await connectDB()

for (const f of FIXES) {
  const r = await Stock.updateOne({ ticker: f.ticker }, { $set: f.set })
  const status = r.matchedCount === 0 ? 'NOT FOUND' : r.modifiedCount ? 'updated' : 'already set'
  console.log(`${f.ticker} ${JSON.stringify(f.set)} -> ${status}`)
}

await disconnectDB()
