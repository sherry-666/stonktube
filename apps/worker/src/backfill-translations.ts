/**
 * Pre-translate all analyzed videos into zh, ko, and en (for non-English videos).
 * Run once after enabling the Google Cloud Translation API.
 *
 * Usage: GOOGLE_TRANSLATE_API_KEY=... npx tsx src/backfill-translations.ts
 */
import 'dotenv/config'
import { connectDB, Video } from '@stonktube/db'

const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'
const LANGS = ['en', 'zh', 'ko'] as const
const BATCH_SIZE = 5

async function translateMany(texts: string[], target: string, source: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY not set')
  if (source === target) return texts
  const nonEmpty = texts.map(t => t || ' ')
  const res = await fetch(`${TRANSLATE_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: nonEmpty, source, target, format: 'text' }),
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

    // For 'en': only non-English videos need translation.
    // For zh/ko: all videos where the translation is missing.
    const query = lang === 'en'
      ? { analysisStatus: 'ANALYZED', language: { $exists: true, $ne: 'en' }, [`translations.en.title`]: { $exists: false } }
      : { analysisStatus: 'ANALYZED', [`translations.${lang}.title`]: { $exists: false } }

    const videos = await Video.find(query).lean()

    console.log(`Found ${videos.length} videos missing ${lang} translation`)

    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async video => {
        try {
          const videoLang = video.language ?? 'en'
          const tickers = video.mentions.filter(m => m.note).map(m => m.ticker)
          const noteTexts = video.mentions.filter(m => m.note).map(m => m.note)

          // Title and summary: translate from the video's own language
          const [titleResult, summaryResult] = await translateMany(
            [video.title, video.summary ?? ''],
            lang,
            videoLang,
          )

          // Notes are always in English
          const translatedNotes = lang === 'en'
            ? noteTexts
            : await translateMany(noteTexts, lang, 'en')

          const noteMap: Record<string, string> = {}
          tickers.forEach((tk, idx) => { noteMap[tk] = translatedNotes[idx] ?? '' })

          await Video.updateOne(
            { _id: video._id },
            {
              $set: {
                [`translations.${lang}.title`]: titleResult,
                [`translations.${lang}.summary`]: summaryResult,
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
