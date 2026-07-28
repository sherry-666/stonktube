import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

function withLang(url: string, lang: string): string {
  if (lang === 'en') return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}lang=${lang}`
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardPill {
  ticker: string
  name: string
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  bullishPct: number
  neutralPct: number
  bearishPct: number
  recentRatings: number
  currency: string
  priceStr: string
  dayChangePct: number
  dayChangeStr: string
  sparkline: number[]
}

export interface FeedVideo {
  id: string
  title: string
  url: string
  thumbnailUrl?: string
  publishedAt: string
  durationSeconds?: number
  creator: {
    name: string
    handle: string
    brandColor: string
    initial: string
    avatarUrl?: string
    slug: string
  }
  primaryTicker: string
  thumbBg: string
  mentions: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
}

export interface MostMentionedRow {
  ticker: string
  brandColor: string
  mentions30d: number
  maxMentions: number
}

export interface MostBullishRow {
  ticker: string
  verdict: string
  bullishPct: number
  recentRatings: number
}

export interface DashboardResponse {
  pills: DashboardPill[]
  feed: FeedVideo[]
  mostMentioned: MostMentionedRow[]
  mostBullish: MostBullishRow[]
}

export function useDashboard(lang: string, initialData?: DashboardResponse) {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', lang],
    queryFn: () => apiFetch<DashboardResponse>(withLang('/api/dashboard', lang)),
    initialData,
    staleTime: initialData ? 60_000 : 0,
  })
}

// ── Stocks ─────────────────────────────────────────────────────────────────

export interface StockRow {
  id: string
  ticker: string
  name: string
  sector: string
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  logoUrl?: string
  currency: string
  priceStr: string
  dayChangePct: number
  dayChangeStr: string
  change30dPct: number
  sparkline: number[]
  sentiment: { bullCount: number; neutralCount: number; bearCount: number; bullishPct: number; neutralPct: number; bearishPct: number; recentRatings: number }
  mentions30d: number
  distinctCreators: number
}

export function useStocks(sort: string, lang: string, initialData?: StockRow[]) {
  return useQuery<StockRow[]>({
    queryKey: ['stocks', sort, lang],
    queryFn: () => apiFetch<StockRow[]>(withLang(`/api/stocks?sort=${sort}`, lang)),
    initialData: sort === 'mentions' ? initialData : undefined,
    staleTime: sort === 'mentions' && initialData ? 60_000 : 0,
  })
}

// ── Stock Detail ───────────────────────────────────────────────────────────

export interface StockDetailStock {
  ticker: string
  name: string
  sector: string
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  logoUrl?: string
  currency: string
  priceStr: string
  dayChangePct: number
  dayChangeStr: string
  trackedBy: number
}

export interface PricePoint {
  date: string
  close: number
}

export interface RecentCoverageEvent {
  videoId: string
  creatorSlug: string
  creatorName: string
  creatorHandle: string
  creatorColor: string
  creatorInitial: string
  creatorAvatarUrl?: string
  publishedAt: string
  title: string
  url: string
  note: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  priceAtMention?: number
  priceStr: string
}

export interface OverallSentiment {
  bullCount: number
  neutralCount: number
  bearCount: number
  bullishPct: number
  neutralPct: number
  bearishPct: number
  total: number
  verdict: string
}

export interface StockDetailResponse {
  stock: StockDetailStock
  priceSeries: PricePoint[]
  recentCoverage: RecentCoverageEvent[]
  overallSentiment: OverallSentiment
}

export function useStockDetail(ticker: string, tf: string, lang: string, initialData?: StockDetailResponse) {
  return useQuery<StockDetailResponse>({
    queryKey: ['stock', ticker, tf, lang],
    queryFn: () => apiFetch<StockDetailResponse>(withLang(`/api/stocks/${ticker}?tf=${tf}`, lang)),
    enabled: !!ticker,
    initialData: tf === '3M' ? initialData : undefined,
    staleTime: tf === '3M' && initialData ? 60_000 : 0,
  })
}

// ── Stock Markers ──────────────────────────────────────────────────────────

export interface Marker {
  videoId: string
  date: string
  priceAtMention?: number
  priceLabel: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  note: string
  creatorSlug: string
  creatorName: string
  creatorColor: string
  creatorInitial: string
  creatorAvatarUrl?: string
  title: string
  url: string
  // computed on the frontend from priceSeries before rendering
  svgX?: number
  svgY?: number
}

export function useStockMarkers(ticker: string, tf: string, lang: string, initialData?: Marker[]) {
  return useQuery<Marker[]>({
    queryKey: ['markers', ticker, tf, lang],
    queryFn: () => apiFetch<Marker[]>(withLang(`/api/stocks/${ticker}/markers?tf=${tf}`, lang)),
    enabled: !!ticker,
    initialData: tf === '3M' ? initialData : undefined,
    staleTime: tf === '3M' && initialData ? 60_000 : 0,
  })
}

// ── Creators ───────────────────────────────────────────────────────────────

export interface CreatorRecentCall {
  videoId: string
  videoTitle: string
  videoUrl: string
  thumbnailUrl?: string
  publishedAt: string
  durationSeconds?: number
  mentions: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
}

export interface CreatorCard {
  slug: string
  name: string
  handle: string
  initial: string
  brandColor: string
  avatarUrl?: string
  channelUrl: string
  bio: string
  tags: string[]
  subscribers: number
  videosTracked: number
  bullishPct: number
  coversTickers: string[]
  recentCalls: CreatorRecentCall[]
}

export function useCreators(lang: string, initialData?: CreatorCard[]) {
  return useQuery<CreatorCard[]>({
    queryKey: ['creators', lang],
    queryFn: () => apiFetch<CreatorCard[]>(withLang('/api/creators', lang)),
    initialData,
    staleTime: initialData ? 60_000 : 0,
  })
}

// ── Creator Profile ──────────────────────────────────────────────────────────

export interface CreatorProfileCall {
  videoId: string
  videoTitle: string
  videoUrl: string
  thumbnailUrl?: string
  publishedAt: string
  durationSeconds?: number
  summary: string
  mentions: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
}

export interface CreatorProfile {
  slug: string
  name: string
  handle: string
  initial: string
  brandColor: string
  avatarUrl?: string
  channelUrl: string
  bio: string
  subscribers?: number
  videosTracked: number
  bullishPct: number
  neutralPct: number
  bearishPct: number
  bullCount: number
  neutralCount: number
  bearCount: number
  covers: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
  calls: CreatorProfileCall[]
}

export function useCreator(slug: string, lang: string, initialData?: CreatorProfile) {
  return useQuery<CreatorProfile>({
    queryKey: ['creator', slug, lang],
    queryFn: () => apiFetch<CreatorProfile>(withLang(`/api/creators/${slug}`, lang)),
    enabled: !!slug,
    initialData,
    staleTime: initialData ? 60_000 : 0,
  })
}

// ── Video Modal ────────────────────────────────────────────────────────────

export interface VideoModalMention {
  ticker: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  stockId: string
  note: string
}

export interface VideoModal {
  id: string
  title: string
  url: string
  thumbnailUrl?: string
  publishedAt: string
  durationSeconds?: number
  creator: {
    name: string
    handle: string
    brandColor: string
    initial: string
    avatarUrl?: string
  }
  primaryTicker: string
  thumbBg: string
  summary: string
  mentions: VideoModalMention[]
}

export function useVideo(id: string | null, lang: string) {
  return useQuery<VideoModal>({
    queryKey: ['video', id, lang],
    queryFn: () => apiFetch<VideoModal>(withLang(`/api/videos/${id}`, lang)),
    enabled: !!id,
  })
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface SearchStock {
  ticker: string
  name: string
  brandColor: string
}

export interface SearchCreator {
  slug: string
  name: string
  handle: string
  brandColor: string
}

export interface SearchResponse {
  stocks: SearchStock[]
  creators: SearchCreator[]
}

export function useSearch(q: string) {
  return useQuery<SearchResponse>({
    queryKey: ['search', q],
    queryFn: () => apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 1,
  })
}
