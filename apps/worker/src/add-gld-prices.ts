import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Stock } from '@stonktube/db'
import { pricesQueue } from '@stonktube/pipeline'

await connectDB()
const gld = await Stock.findOne({ ticker: 'GLD' })
if (!gld) throw new Error('GLD not found')

await pricesQueue.add('fillPrices', { stockId: gld._id.toString() }, { jobId: `prices-${gld._id}-${Date.now()}` })
console.log('Enqueued prices job for GLD:', gld._id.toString())
await disconnectDB()
await pricesQueue.close()
