import mongoose, { Types } from 'mongoose'

export interface PricePoint {
  date: Date
  meta: { stockId: Types.ObjectId; ticker: string }
  close: number
  source: string
}

function collection() {
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')
  return db.collection<PricePoint>('pricepoints')
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getPrices(stockId: Types.ObjectId, startDate: Date): Promise<PricePoint[]> {
  const docs = await collection()
    .find({ 'meta.stockId': stockId, date: { $gte: startDate } })
    .sort({ date: 1 })
    .toArray()

  // Collapse duplicate calendar dates. The price-fill job fetches overlapping
  // recent bars on each run, so the same trading day can be stored multiple
  // times; keeping every copy makes the chart flat-line on the latest date.
  // Docs are sorted ascending, so the last write for a given day wins.
  const byDay = new Map<string, PricePoint>()
  for (const p of docs) byDay.set(dayKey(p.date as Date), p)
  return [...byDay.values()]
}

export async function insertPrices(points: PricePoint[]): Promise<void> {
  if (points.length === 0) return
  // Upsert on (stockId, day) so re-running the fill job over an overlapping
  // date range refreshes existing points instead of duplicating them.
  await collection().bulkWrite(
    points.map((p) => {
      const start = new Date(`${dayKey(p.date)}T00:00:00.000Z`)
      const end = new Date(start.getTime() + 86_400_000)
      return {
        updateOne: {
          filter: { 'meta.stockId': p.meta.stockId, date: { $gte: start, $lt: end } },
          update: { $set: p },
          upsert: true,
        },
      }
    }),
    { ordered: false },
  )
}

export async function deletePricesForStock(stockId: Types.ObjectId): Promise<void> {
  await collection().deleteMany({ 'meta.stockId': stockId })
}
