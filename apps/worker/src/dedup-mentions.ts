import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'

await connectDB()

const videos = await Video.find({ analysisStatus: 'ANALYZED', 'mentions.1': { $exists: true } })
let fixed = 0

for (const v of videos) {
  const mentions = v.mentions as any[]
  const bestByTicker = new Map<string, any>()
  for (const m of mentions) {
    const existing = bestByTicker.get(m.ticker)
    if (!existing || m.isPrimary || (m.confidence ?? 0) > (existing.confidence ?? 0)) {
      bestByTicker.set(m.ticker, m)
    }
  }
  const deduped = [...bestByTicker.values()]
  if (deduped.length < mentions.length) {
    await v.updateOne({ mentions: deduped })
    console.log(`Fixed: ${v.title?.slice(0, 50)} (${mentions.length} → ${deduped.length} mentions)`)
    fixed++
  }
}

console.log(`\nFixed ${fixed} videos`)
await disconnectDB()
