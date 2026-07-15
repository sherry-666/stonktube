import { Stock } from '@stonktube/db'
import { translateMany } from './translate.js'

type SupportedLang = 'zh' | 'ko'

function isSupportedLang(lang: string): lang is SupportedLang {
  return lang === 'zh' || lang === 'ko'
}

interface LeanStock {
  _id: unknown
  name: string
  sector: string
  translations?: Record<string, { name?: string; sector?: string }>
}

// Format: "苹果 (Apple)" — translated first, English in parens
function withEnglish(translated: string, english: string): string {
  if (translated === english) return english
  return `${translated} (${english})`
}

export interface StockNameSector {
  name: string
  sector: string
}

// Batch-translate name+sector for a list of stocks in a single API call.
// Caches results back to MongoDB (fire and forget).
export async function getStockTranslationsBatch(
  stocks: LeanStock[],
  lang: string,
): Promise<StockNameSector[]> {
  if (!isSupportedLang(lang)) {
    return stocks.map(s => ({ name: s.name, sector: s.sector }))
  }

  // Split into cached and uncached
  type IndexedStock = { stock: LeanStock; idx: number }
  const cached: Array<{ idx: number; name: string; sector: string }> = []
  const uncached: IndexedStock[] = []

  for (let i = 0; i < stocks.length; i++) {
    const tr = stocks[i].translations?.[lang]
    if (tr?.name) {
      cached.push({ idx: i, name: tr.name, sector: tr.sector ?? stocks[i].sector })
    } else {
      uncached.push({ stock: stocks[i], idx: i })
    }
  }

  const results: StockNameSector[] = stocks.map(s => ({ name: s.name, sector: s.sector }))

  // Apply cached translations (already formatted from a prior run)
  for (const c of cached) {
    results[c.idx] = { name: c.name, sector: c.sector }
  }

  if (uncached.length === 0) return results

  // Build one big translate call: [name0, sector0, name1, sector1, ...]
  const texts = uncached.flatMap(({ stock }) => [stock.name, stock.sector || ''])
  const translated = await translateMany(texts, lang)

  const writes: Array<{ id: unknown; name: string; sector: string }> = []

  uncached.forEach(({ stock, idx }, i) => {
    const tName = translated[i * 2] ?? stock.name
    const tSector = translated[i * 2 + 1] ?? stock.sector
    const name = withEnglish(tName, stock.name)
    const sector = stock.sector ? withEnglish(tSector, stock.sector) : ''
    results[idx] = { name, sector }
    writes.push({ id: stock._id, name, sector })
  })

  // Write-back (fire and forget)
  Promise.all(
    writes.map(w =>
      Stock.updateOne(
        { _id: w.id },
        { $set: { [`translations.${lang}.name`]: w.name, [`translations.${lang}.sector`]: w.sector } },
      ),
    ),
  ).catch(err => console.error('[stockTranslation] cache write failed', err))

  return results
}

// Single stock translation for the detail page
export async function getStockTranslation(
  stock: LeanStock,
  lang: string,
): Promise<StockNameSector> {
  const [result] = await getStockTranslationsBatch([stock], lang)
  return result
}
