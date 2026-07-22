interface LeanStock {
  _id: unknown
  name: string
  sector: string
  translations?: Record<string, { name?: string; sector?: string }>
}

export interface StockNameSector {
  name: string
  sector: string
}

// Returns hand-curated translation if available, otherwise falls back to English.
export async function getStockTranslationsBatch(
  stocks: LeanStock[],
  lang: string,
): Promise<StockNameSector[]> {
  if (lang === 'en') {
    return stocks.map(s => ({ name: s.name, sector: s.sector }))
  }

  return stocks.map(s => {
    const tr = s.translations?.[lang]
    return {
      name: tr?.name ?? s.name,
      sector: tr?.sector ?? s.sector,
    }
  })
}

// Single stock translation for the detail page
export async function getStockTranslation(
  stock: LeanStock,
  lang: string,
): Promise<StockNameSector> {
  const [result] = await getStockTranslationsBatch([stock], lang)
  return result
}

