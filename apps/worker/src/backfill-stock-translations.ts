/**
 * Pre-translate all stock names and sectors into zh and ko.
 * Usage: GOOGLE_TRANSLATE_API_KEY=... npx tsx src/backfill-stock-translations.ts
 */
import 'dotenv/config'
import { connectDB, Stock } from '@stonktube/db'

const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'
const LANGS = ['zh', 'ko'] as const

async function translateMany(texts: string[], target: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY not set')
  const res = await fetch(`${TRANSLATE_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: 'en', target, format: 'text' }),
  })
  if (!res.ok) throw new Error(`Translate API ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
  return data.data?.translations?.map(t => t.translatedText) ?? texts
}

function withEnglish(translated: string, english: string): string {
  return translated === english ? english : `${translated} (${english})`
}

async function main() {
  await connectDB()
  console.log('Connected to MongoDB')

  const stocks = await Stock.find({}).lean()
  console.log(`Found ${stocks.length} stocks`)

  for (const lang of LANGS) {
    const missing = stocks.filter(s => !s.translations?.[lang]?.name)
    console.log(`\n=== ${lang}: ${missing.length} stocks need translation ===`)
    if (missing.length === 0) continue

    // Batch all names + sectors in one API call
    const texts = missing.flatMap(s => [s.name, s.sector || ''])
    const translated = await translateMany(texts, lang)

    await Promise.all(
      missing.map(async (s, i) => {
        const tName = translated[i * 2] ?? s.name
        const tSector = translated[i * 2 + 1] ?? s.sector
        const name = withEnglish(tName, s.name)
        const sector = s.sector ? withEnglish(tSector, s.sector) : ''
        await Stock.updateOne(
          { _id: s._id },
          { $set: { [`translations.${lang}.name`]: name, [`translations.${lang}.sector`]: sector } },
        )
        console.log(`  ${s.ticker}: ${s.name} → ${name}`)
      }),
    )
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
