/**
 * Physically remove duplicate same-day price points left by the old fill job
 * (which re-inserted the latest trading day on every run, flat-lining charts).
 *
 * pricepoints is a time-series collection, so selective per-document deletes
 * aren't allowed. Instead, per stock that has duplicates: read its points,
 * keep one per calendar day, delete all of the stock's points (delete by the
 * metaField is permitted on TS collections), and re-insert the deduped set.
 *
 * Real data only — no synthetic points are added. Safe to re-run (a clean stock
 * is skipped).
 *
 *   pnpm --filter @stonktube/db build
 *   node packages/db/dist/dedupe-prices.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose from 'mongoose'
import { connectDB, disconnectDB, Stock, insertPrices } from './index.js'
import type { PricePoint } from './pricePoints.js'

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

await connectDB()
const db = mongoose.connection.db!
const coll = db.collection('pricepoints')

const stocks = await Stock.find({}, '_id ticker').lean()
let totalRemoved = 0

for (const stock of stocks) {
  const docs = (await coll
    .find({ 'meta.stockId': stock._id })
    .sort({ date: 1 })
    .toArray()) as unknown as (PricePoint & { _id: unknown })[]

  if (docs.length === 0) continue

  // Keep the last document per calendar day (closes are identical for dupes).
  const byDay = new Map<string, PricePoint>()
  for (const d of docs) {
    byDay.set(dayKey(d.date as Date), { date: d.date, meta: d.meta, close: d.close, source: d.source })
  }

  const deduped = [...byDay.values()]
  const removed = docs.length - deduped.length
  if (removed === 0) {
    console.log(`${stock.ticker}: clean (${docs.length} days)`)
    continue
  }

  await coll.deleteMany({ 'meta.stockId': stock._id })
  await insertPrices(deduped)
  totalRemoved += removed
  console.log(`${stock.ticker}: removed ${removed} duplicates -> ${deduped.length} days`)
}

console.log(`\nDone. Removed ${totalRemoved} duplicate price points total.`)
await disconnectDB()
