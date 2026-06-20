/**
 * One-shot maintenance: remove duplicate price points (the old fill job inserted
 * overlapping bars, so the latest trading day accumulated many copies and
 * flat-lined charts / sparklines and zeroed day change), then recompute every
 * stock's cached stats.
 *
 * Safe to re-run. Reads/writes only real data — no synthetic points are added.
 *
 *   pnpm --filter @stonktube/db build
 *   node packages/db/dist/recompute-stats.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import mongoose from 'mongoose'
import { connectDB, disconnectDB } from './index.js'
import { rebuildStats } from './rollup.js'

await connectDB()
const db = mongoose.connection.db!

// 1. Collapse duplicate (stockId, calendar-day) price points, keeping one each.
const groups = await db
  .collection('pricepoints')
  .aggregate<{ ids: mongoose.Types.ObjectId[] }>([
    {
      $group: {
        _id: {
          stockId: '$meta.stockId',
          day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ])
  .toArray()

const toDelete: mongoose.Types.ObjectId[] = []
for (const g of groups) {
  // Keep the first id for each day, drop the rest (closes are identical).
  toDelete.push(...g.ids.slice(1))
}

if (toDelete.length > 0) {
  const res = await db.collection('pricepoints').deleteMany({ _id: { $in: toDelete } })
  console.log(`Removed ${res.deletedCount} duplicate price points across ${groups.length} days`)
} else {
  console.log('No duplicate price points found')
}

// 2. Recompute cached stock stats (sparkline, dayChangePct, change30dPct, sentiment).
await rebuildStats()
console.log('Recomputed stats for all stocks')

await disconnectDB()
