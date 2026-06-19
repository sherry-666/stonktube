import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardPill {
  ticker: string
  name: string
  brandColor: string
  logoBg?: string
  bullishPct: number
  price: number
  dayChangePct: number
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
  rank: number
  ticker: string
  name: string
  brandColor: string
  mentions30d: number
}

export interface MostBullishRow {
  rank: number
  ticker: string
  name: string
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
  ticker: string
  name: string
  sector: string
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  price: number
  dayChangePct: number
  change30dPct: number
  sparkline: number[]
  bullCount: number
  neutralCount: number
  bearCount: number
  bullishPct: number
  mentions: number
  creatorCount: number
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
  price: number
  dayChangePct: number
  trackedByCount: number
}

export interface PricePoint {
  date: string
  price: number
}

export interface RecentCoverageEvent {
  id: string
  creatorName: string
  creatorHandle: string
  creatorBrandColor: string
  creatorInitial: string
  creatorAvatarUrl?: string
  publishedAt: string
  title: string
  url: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  priceAtMention: number
}

export interface OverallSentiment {
  bullCount: number
  neutralCount: number
  bearCount: number
  bullishPct: number
  totalRatings: number
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
  id: string
  date: string
  price: number
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  creatorName: string
  creatorHandle: string
  creatorBrandColor: string
  creatorInitial: string
  creatorAvatarUrl?: string
  videoTitle: string
  videoUrl: string
  svgX: number
  svgY: number
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
