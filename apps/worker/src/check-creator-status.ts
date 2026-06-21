import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve('/Users/sjin/src/stonktube/.env') })
import { connectDB, disconnectDB, Creator, Video } from '@stonktube/db'
await connectDB()
const slug = process.env.CREATOR_SLUG ?? 'meitou-news'
const creator = await Creator.findOne({ slug }).lean()
if (!creator) { console.error('Not found:', slug); process.exit(1) }
const videos = await Video.find({ creatorId: creator._id }).sort({ publishedAt: -1 }).lean()
const byStatus: Record<string, number> = {}
for (const v of videos) {
  const k = `${v.transcriptStatus}/${v.analysisStatus}`
  byStatus[k] = (byStatus[k] ?? 0) + 1
}
console.log(JSON.stringify({ total: videos.length, byStatus }))
const pending = videos.filter(v => v.transcriptStatus === 'PENDING' || v.analysisStatus === 'PENDING')
const failed = videos.filter(v => v.transcriptStatus === 'FAILED' || v.analysisStatus === 'FAILED')
console.log(`  pending:${pending.length}  failed:${failed.length}`)
if (pending.length > 0) {
  console.log('Most recent pending:')
  pending.slice(0, 3).forEach(v => console.log(`  ${v.publishedAt?.toISOString().slice(0,10)} ${v.title?.slice(0,60)}  [${v.transcriptStatus}/${v.analysisStatus}]`))
}
await disconnectDB()
