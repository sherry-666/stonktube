import { connectDB, disconnectDB, ensureIndexes } from '@stonktube/db'

async function run() {
  await connectDB()
  await ensureIndexes()
  await disconnectDB()
  console.log('Bootstrap complete')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
