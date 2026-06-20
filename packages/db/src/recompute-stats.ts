/**
 * Recompute every stock's cached stats (sparkline, dayChangePct, change30dPct,
 * sentiment) from current price + mention data.
 *
 * Run this after a price fill or symbol fix to refresh the dashboard, which
 * reads the precomputed stats rather than live prices. Safe to re-run.
 *
 * Note: `pricepoints` is a time-series collection, so duplicate same-day points
 * left by older fills aren't deleted here — getPrices() and the rollup collapse
 * them on read, so stats come out correct regardless.
 *
 *   pnpm --filter @stonktube/db build
 *   node packages/db/dist/recompute-stats.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB } from './index.js'
import { rebuildStats } from './rollup.js'

await connectDB()
await rebuildStats()
console.log('Recomputed stats for all stocks')
await disconnectDB()
