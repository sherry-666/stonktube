/**
 * One-time migration: rename SK Hynix from the KRX ticker (000660.KS) to the
 * US OTC ADR ticker (SKHY).
 *
 * Changes:
 *  1. Stock.ticker  000660.KS → SKHY  (clears priceSymbol — SKHY is the Yahoo symbol directly)
 *  2. Video.mentions[].ticker  000660.KS → SKHY  (for every video that mentioned it)
 *  3. Deletes all price-point data for this stock  (KRW prices are wrong for SKHY;
 *     the price-fill job will re-fetch USD prices on its next run)
 *
 * Usage (run from repo root):
 *   pnpm --filter @stonktube/db build && node packages/db/dist/migrate-skhynix.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB } from './index.js'
import { Stock } from './models/Stock.js'
import { Video } from './models/Video.js'
import { deletePricesForStock } from './pricePoints.js'

const OLD = '000660.KS'
const NEW = 'SKHY'

await connectDB()

const stock = await Stock.findOne({ ticker: OLD })
if (!stock) {
  console.log(`Stock ${OLD} not found — already migrated or never existed.`)
  await disconnectDB()
  process.exit(0)
}

// 1. Rename ticker on the stock doc
await Stock.updateOne(
  { _id: stock._id },
  { $set: { ticker: NEW }, $unset: { priceSymbol: '' } },
)
console.log(`Stock: ${OLD} → ${NEW}`)

// 2. Update ticker inside Video.mentions arrays
const videoResult = await Video.updateMany(
  { 'mentions.ticker': OLD },
  { $set: { 'mentions.$[m].ticker': NEW } },
  { arrayFilters: [{ 'm.ticker': OLD }] },
)
console.log(`Videos updated: ${videoResult.modifiedCount}`)

// 3. Delete stale KRW price data so the pipeline re-fetches USD prices
await deletePricesForStock(stock._id)
console.log(`Price points deleted for stockId ${stock._id}`)

console.log('Done. Run a price-fill + rollup to populate SKHY prices.')
await disconnectDB()
