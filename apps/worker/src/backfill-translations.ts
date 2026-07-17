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

async function translateMany(texts: string[], target: string, source?: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY not set')
  const nonEmpty = texts.map(t => t || ' ')
  const body: Record<string, unknown> = { q: nonEmpty, target, format: 'text' }
  if (source) body.source = source
  const res = await fetch(`${TRANSLATE_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Translate API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
  return data.data?.translations?.map(t => t.translatedText) ?? texts
}

function looksNonEnglish(text: string): boolean {
  return /[^ -ɏ]/.test(text)
}

async function main() {
  await connectDB()
  console.log('Connected to MongoDB')

  // Purge poisoned cache entries from the earlier version of this script:
  // for videos in language L, the L-target run short-circuited on
  // source === target and cached the raw ENGLISH summary/notes untranslated.
  for (const lang of ['zh', 'ko']) {
    const res = await Video.updateMany(
      { language: lang, [`translations.${lang}`]: { $exists: true } },
      { $unset: { [`translations.${lang}`]: '' } },
    )
    if (res.modifiedCount) console.log(`Purged ${res.modifiedCount} stale ${lang} cache entries`)
  }

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
          const mislabeled = videoLang === 'en' && looksNonEnglish(video.title)
          const titleIsNative = !mislabeled && videoLang === lang
          const tickers = video.mentions.filter(m => m.note).map(m => m.ticker)
          const noteTexts = video.mentions.filter(m => m.note).map(m => m.note)

          // Title: from the video's own language (auto-detect if mislabeled)
          const [titleResult] = titleIsNative
            ? [video.title]
            : await translateMany([video.title], lang, mislabeled ? undefined : videoLang)

          // Summary + notes: pipeline output is English regardless of video language
          const [summaryResult] = lang === 'en'
            ? [video.summary ?? '']
            : await translateMany([video.summary ?? ''], lang)
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
