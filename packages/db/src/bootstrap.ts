import mongoose from 'mongoose'

export async function ensureIndexes(): Promise<void> {
  // Ensure the pricePoints time-series collection exists.
  // Mongoose doesn't have native time-series support, so we create it via the raw driver.
  const db = mongoose.connection.db
  if (!db) throw new Error('DB not connected')

  const collections = await db.listCollections({ name: 'pricepoints' }).toArray()
  if (collections.length === 0) {
    await db.createCollection('pricepoints', {
      timeseries: {
        timeField: 'date',
        metaField: 'meta',
        granularity: 'hours',
      },
    })
    console.log('Created pricepoints time-series collection')
  }
}
