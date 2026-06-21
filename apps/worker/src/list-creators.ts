import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve('/Users/sjin/src/stonktube/.env') })
import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
await connectDB()
const creators = await Creator.find({}).sort({ name: 1 }).lean()
for (const c of creators) {
  const vcount = await Video.countDocuments({ creatorId: c._id })
  const analyzed = await Video.countDocuments({ creatorId: c._id, analysisStatus: 'ANALYZED' })
  console.log(JSON.stringify({ slug: c.slug, name: c.name, handle: c.handle, isActive: c.isActive, videos: vcount, analyzed }))
}
await disconnectDB()
