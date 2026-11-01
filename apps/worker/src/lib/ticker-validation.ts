/**
 * Decides whether a ticker the LLM reported can become a Stock record. Yahoo
 * resolves many bare symbols to an unrelated security (USDC -> USDATA Corp,
 * ANTH -> Anthera Pharmaceuticals) or to a shell record with no price (XMR, DXY),
 * so a quote existing proves nothing. The LLM's asset name is the only signal of
 * what the creator meant, so it has to agree with the name Yahoo returns.
 */

export interface TickerQuote {
  quoteType?: string
  regularMarketPrice?: number
  shortName?: string
  longName?: string
  sector?: string
}

export type QuoteFn = (symbol: string) => Promise<TickerQuote | undefined>

export interface ResolvedTicker {
  ticker: string
  name: string
  sector: string
}

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'plc', 'llc', 'lp',
  'sa', 'ag', 'nv', 'se', 'ab', 'holding', 'holdings', 'group', 'the', 'of', 'and', 'class', 'common', 'stock',
])

function nameTokens(name: string): string[] {
  const tokens = name.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return tokens.filter((t) => !LEGAL_SUFFIXES.has(t))
}

/** True when every word of the shorter name is in the longer one, or they differ only in spacing. */
export function namesMatch(a: string, b: string): boolean {
  const tokensA = nameTokens(a)
  const tokensB = nameTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return false
  const [fewer, more] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA]
  if (fewer.every((t) => more.includes(t))) return true
  // "JPMorgan" vs "JP Morgan Chase", "USD Coin" vs "USDC".
  const joinedA = tokensA.join('')
  const joinedB = tokensB.join('')
  const [shorter, longer] = joinedA.length <= joinedB.length ? [joinedA, joinedB] : [joinedB, joinedA]
  return shorter.length >= 4 && longer.startsWith(shorter)
}

/** Yahoo's name for a quote with a real price, or null for a shell record. */
function tradableName(quote: TickerQuote | undefined): string | null {
  if (!quote || !quote.regularMarketPrice || quote.regularMarketPrice <= 0) return null
  if (quote.quoteType === 'ECNQUOTE') return null
  return quote.shortName ?? quote.longName ?? null
}

/**
 * Yahoo symbol and name for an asset the LLM reported, or null when nothing on
 * Yahoo matches it. A bare crypto symbol is often taken by an unrelated stock,
 * so a mismatch falls back to SYMBOL-USD, which must actually be a crypto quote.
 */
export async function resolveNewTicker(ticker: string, name: string, quote: QuoteFn): Promise<ResolvedTicker | null> {
  const upper = ticker.toUpperCase()

  const direct = await quote(upper)
  const directName = tradableName(direct)
  if (directName && namesMatch(name, directName)) {
    return { ticker: upper, name: directName, sector: direct?.sector ?? '' }
  }

  if (!/^[A-Z0-9]+$/.test(upper)) return null
  const cryptoSymbol = `${upper}-USD`
  const crypto = await quote(cryptoSymbol)
  const cryptoName = tradableName(crypto)
  if (crypto?.quoteType !== 'CRYPTOCURRENCY' || !cryptoName) return null
  const assetName = cryptoName.replace(/ USD$/, '')
  if (!namesMatch(name, assetName)) return null
  return { ticker: cryptoSymbol, name: assetName, sector: 'Cryptocurrency' }
}
