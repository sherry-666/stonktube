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

export async function getPrices(stockId: Types.ObjectId, startDate: Date): Promise<PricePoint[]> {
  return collection()
    .find({ 'meta.stockId': stockId, date: { $gte: startDate } })
    .sort({ date: 1 })
    .toArray()
}

export async function insertPrices(points: PricePoint[]): Promise<void> {
  if (points.length === 0) return
  await collection().insertMany(points)
}

export async function deletePricesForStock(stockId: Types.ObjectId): Promise<void> {
  await collection().deleteMany({ 'meta.stockId': stockId })
}
