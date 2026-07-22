import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const TAGS: Record<string, string[]> = {
  andrei:       ['dividends'],
  bella:        ['politics'],
  joseph:       ['dividends'],
  moneydo:      ['macro'],
  marketbeat:   ['news', 'technical'],
  kevin:        ['macro', 'news', 'politics'],
  'meitou-news': ['news'],
  mei:          ['technical'],
  nana:         ['technical'],
  rhino:        ['macro'],
  tom:          ['macro'],
  bonnie:       ['crypto'],
  sosumonkey:   [],
}

await connectDB()

let updated = 0
for (const [slug, tags] of Object.entries(TAGS)) {
  const result = await Creator.updateOne({ slug }, { $set: { tags } })
  if (result.matchedCount === 0) {
    console.warn(`slug not found: ${slug}`)
  } else {
    console.log(`✓ ${slug}: [${tags.join(', ')}]`)
    updated++
  }
}

console.log(`\nUpdated ${updated}/${Object.keys(TAGS).length} creators`)
await disconnectDB()
