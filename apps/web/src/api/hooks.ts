import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardPill {
  ticker: string
  name: string
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  bullishPct: number
  recentRatings: number
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
}

export interface DashboardResponse {
  pills: DashboardPill[]
  feed: FeedVideo[]
  mostMentioned: MostMentionedRow[]
  mostBullish: MostBullishRow[]
}

export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardResponse>('/api/dashboard'),
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
  priceStr: string
  dayChangePct: number
  dayChangeStr: string
  change30dPct: number
  sparkline: number[]
  sentiment: { bullCount: number; neutralCount: number; bearCount: number; bullishPct: number }
  mentions30d: number
  distinctCreators: number
}

export function useStocks(sort: string) {
  return useQuery<StockRow[]>({
    queryKey: ['stocks', sort],
    queryFn: () => apiFetch<StockRow[]>(`/api/stocks?sort=${sort}`),
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
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  priceAtMention?: number
  priceStr: string
}

export interface OverallSentiment {
  bullCount: number
  neutralCount: number
  bearCount: number
  bullishPct: number
  total: number
  verdict: string
}

export interface StockDetailResponse {
  stock: StockDetailStock
  priceSeries: PricePoint[]
  recentCoverage: RecentCoverageEvent[]
  overallSentiment: OverallSentiment
}

export function useStockDetail(ticker: string, tf: string) {
  return useQuery<StockDetailResponse>({
    queryKey: ['stock', ticker, tf],
    queryFn: () => apiFetch<StockDetailResponse>(`/api/stocks/${ticker}?tf=${tf}`),
    enabled: !!ticker,
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

export function useStockMarkers(ticker: string, tf: string) {
  return useQuery<Marker[]>({
    queryKey: ['markers', ticker, tf],
    queryFn: () => apiFetch<Marker[]>(`/api/stocks/${ticker}/markers?tf=${tf}`),
    enabled: !!ticker,
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
  subscribers: number
  videosTracked: number
  bullishPct: number
  coversTickers: string[]
  recentCalls: CreatorRecentCall[]
}

export function useCreators() {
  return useQuery<CreatorCard[]>({
    queryKey: ['creators'],
    queryFn: () => apiFetch<CreatorCard[]>('/api/creators'),
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
  bullCount: number
  neutralCount: number
  bearCount: number
  covers: { ticker: string; sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; stockId: string }[]
  calls: CreatorProfileCall[]
}

export function useCreator(slug: string) {
  return useQuery<CreatorProfile>({
    queryKey: ['creator', slug],
    queryFn: () => apiFetch<CreatorProfile>(`/api/creators/${slug}`),
    enabled: !!slug,
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

export function useVideo(id: string | null) {
  return useQuery<VideoModal>({
    queryKey: ['video', id],
    queryFn: () => apiFetch<VideoModal>(`/api/videos/${id}`),
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
