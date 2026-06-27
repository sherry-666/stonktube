import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Video } from '@stonktube/db'

// Titles matching these are clearly not finance/stock/crypto/macro content
const NON_FINANCE_PATTERNS = [
  /air india/i,
  /epstein/i,
  /ghislaine/i,
  /mamdani/i,
  /diddy.*verdict|diddy.*guilty|diddy.*prison/i,
  /hot.crazy matrix/i,
  /captain steeeve/i,
  /pilot explains/i,
  /\bplanes?\b.*crash|crash.*\bplane\b/i,
  /boeing.*plunges|plunges.*boeing/i,
  /laguardia.*crash|crash.*laguardia/i,
  /dangerous jet landing/i,
  /deport citizens/i,
  /grok.*racist|racist.*grok/i,
  /running for governor/i,
  /caleb hammer financial audit/i,
  /popcorn ceiling/i,
  /my private jet cost/i,
  /why i sued cnn/i,
  /pbd on being an atheist/i,
  /pbd on having a single president/i,
]

const DRY_RUN = process.env.DRY_RUN !== 'false'

await connectDB()

const videos = await Video.find({
  'creator.slug': process.env.CREATOR_SLUG ?? 'kevin',
  transcriptStatus: 'PENDING',
}).select('title durationSeconds').lean()

const toDelete = videos.filter(v => NON_FINANCE_PATTERNS.some(p => p.test(v.title ?? '')))
const ids = toDelete.map(v => v._id)

console.log(`Matched ${toDelete.length} non-finance videos out of ${videos.length} PENDING:`)
for (const v of toDelete) {
  console.log(`  [${v.durationSeconds}s] ${v.title}`)
}

if (DRY_RUN) {
  console.log('\nDRY RUN — set DRY_RUN=false to actually delete')
} else {
  const result = await Video.deleteMany({ _id: { $in: ids } })
  console.log(`\nDeleted ${result.deletedCount} videos`)
}

await (await import('@stonktube/db')).disconnectDB()
