import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Stock } from './index.js'

const CRYPTO = [
  { ticker: 'BTC-USD', name: 'Bitcoin', sector: 'Cryptocurrency', brandColor: '#F7931A', logoBg: '#1A1A1A', initials: 'BT', aliases: ['Bitcoin', 'BTC', '比特币', 'bitcoin'] },
  { ticker: 'ETH-USD', name: 'Ethereum', sector: 'Cryptocurrency', brandColor: '#627EEA', logoBg: '#1A1A1A', initials: 'ET', aliases: ['Ethereum', 'ETH', '以太坊', 'ethereum'] },
]

await connectDB()
for (const s of CRYPTO) {
  const r = await Stock.findOneAndUpdate(
    { ticker: s.ticker },
    { $setOnInsert: { ...s, isPrivate: false, trackedBy: 0, aliases: s.aliases } },
    { upsert: true, new: false },
  )
  console.log(s.ticker, r ? 'already exists' : 'created ✓')
}
await disconnectDB()
