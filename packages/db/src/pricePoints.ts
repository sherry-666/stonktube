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
  // `pricepoints` is a time-series collection, which only supports inserts (no
  // upserts/updates). Callers must avoid re-inserting an already-stored day;
  // getPrices() and the rollup also collapse duplicate days defensively on read.
  await collection().insertMany(points)
}

export async function deletePricesForStock(stockId: Types.ObjectId): Promise<void> {
  await collection().deleteMany({ 'meta.stockId': stockId })
}
