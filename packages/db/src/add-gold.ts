import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Stock } from './index.js'

const GOLD = { ticker: 'GLD', name: 'Gold', sector: 'Commodity', brandColor: '#FFD700', logoBg: '#1A1A1A', initials: 'AU', aliases: ['Gold', 'gold', '黄金', 'XAUUSD'] }

await connectDB()
const r = await Stock.findOneAndUpdate(
  { ticker: GOLD.ticker },
  { $setOnInsert: { ...GOLD, isPrivate: false, trackedBy: 0, aliases: GOLD.aliases } },
  { upsert: true, new: false },
)
console.log(GOLD.ticker, r ? 'already exists' : 'created ✓')
await disconnectDB()
