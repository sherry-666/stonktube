import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { pricesQueue } from '@stonktube/pipeline'

await pricesQueue.add(
  'fillPrices',
  { stockId: undefined },
  { jobId: `prices-all-manual-${Date.now()}` },
)
console.log('Price fill job enqueued for all stocks')
await pricesQueue.close()
