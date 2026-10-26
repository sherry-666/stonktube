// Field projections for API queries. Full Stock/Video documents carry fields
// the responses never use, and pulling them whole from Atlas dominated
// response time — so every list query selects only what it reads.

const STOCK_CARD_FIELDS = 'ticker name sector isPrivate brandColor logoBg initials logoUrl stats'

// Stock card/detail fields, plus the cached name/sector translation for `lang`.
export function stockFields(lang: string): string {
  return lang === 'en' ? STOCK_CARD_FIELDS : `${STOCK_CARD_FIELDS} translations.${lang}`
}

// Everything getVideoTranslation() and the video card/coverage rows read.
// `summary` must stay: getVideoTranslation caches a translated summary, and
// an omitted one would be cached as ''.
export function videoCardFields(lang: string): string {
  return `creatorId creator title url thumbnailUrl durationSeconds publishedAt language summary mentions translations.${lang}`
}

// Just enough to count sentiment / covered tickers / tracking creators.
export const VIDEO_STATS_FIELDS =
  'creatorId publishedAt mentions.stockId mentions.ticker mentions.sentiment mentions.relevance mentions.stance mentions.isPrimary mentions.confidence'
