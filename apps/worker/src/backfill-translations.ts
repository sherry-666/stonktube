/**
 * Pre-translate all analyzed videos into zh and ko using Google Translate.
 * Run once after enabling the Google Cloud Translation API.
 *
 * Usage: GOOGLE_TRANSLATE_API_KEY=... npx tsx src/backfill-translations.ts
 */
import 'dotenv/config'
import { connectDB, Video } from '@stonktube/db'

const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'
const LANGS = ['zh', 'ko'] as const
const BATCH_SIZE = 5

async function translateMany(texts: string[], target: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY not set')
  const nonEmpty = texts.map(t => t || ' ')
  const res = await fetch(`${TRANSLATE_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: nonEmpty, source: 'en', target, format: 'text' }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Translate API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
  return data.data?.translations?.map(t => t.translatedText) ?? texts
}

async function main() {
  await connectDB()
  console.log('Connected to MongoDB')

  for (const lang of LANGS) {
    console.log(`\n=== Translating to ${lang} ===`)

    const videos = await Video.find({
      analysisStatus: 'ANALYZED',
      [`translations.${lang}.title`]: { $exists: false },
    }).lean()

    console.log(`Found ${videos.length} videos missing ${lang} translation`)

    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async video => {
        try {
          const tickers = video.mentions.filter(m => m.note).map(m => m.ticker)
          const notes = video.mentions.filter(m => m.note).map(m => m.note)
          const texts = [video.title, video.summary ?? '', ...notes]
          const translated = await translateMany(texts, lang)

          const title = translated[0]
          const summary = translated[1]
          const noteMap: Record<string, string> = {}
          tickers.forEach((tk, idx) => {
            noteMap[tk] = translated[2 + idx] ?? ''
          })

          await Video.updateOne(
            { _id: video._id },
            {
              $set: {
                [`translations.${lang}.title`]: title,
                [`translations.${lang}.summary`]: summary,
                [`translations.${lang}.notes`]: noteMap,
              },
            },
          )
        } catch (err) {
          console.error(`  Failed video ${video._id}:`, err)
        }
      }))

      const done = Math.min(i + BATCH_SIZE, videos.length)
      console.log(`  ${done}/${videos.length} done`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
