import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { Queue } from 'bullmq'

const conn = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' }
const names = ['discover', 'transcribe', 'analyze', 'prices', 'rollup']
for (const name of names) {
  const q = new Queue(name, { connection: conn })
  await q.obliterate({ force: true })
  console.log('Flushed:', name)
  await q.close()
}
console.log('All queues flushed')
