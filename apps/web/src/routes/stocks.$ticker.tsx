import type { Route } from './+types/stocks.$ticker.js'
import { apiFetch } from '../api/client.js'
import type { StockDetailResponse, Marker } from '../api/hooks.js'
import StockDetail from '../screens/StockDetail.js'

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const tf = url.searchParams.get('tf') ?? '3M'
  const lang = url.searchParams.get('lang') ?? 'en'
  const langQs = lang !== 'en' ? `&lang=${lang}` : ''

  const [detail, markers] = await Promise.all([
    apiFetch<StockDetailResponse>(`/api/stocks/${params.ticker}?tf=${tf}${langQs}`),
    apiFetch<Marker[]>(`/api/stocks/${params.ticker}/markers?tf=${tf}${langQs}`),
  ])
  return { detail, markers }
}

export function meta({ data, params }: Route.MetaArgs) {
  const ticker = params.ticker?.toUpperCase() ?? ''
  const stock = data?.detail?.stock
  const title = stock
    ? `${stock.name} (${ticker}) Stock Picks · StonkTube`
    : `${ticker} · StonkTube`
  const description = stock
    ? `See what YouTube finance creators and influencers say about ${stock.name} (${ticker}). Track bullish/bearish sentiment, recent coverage, and price history on StonkTube.`
    : `Stock picks and sentiment for ${ticker} from YouTube finance creators.`
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
  ]
}

export default function StockDetailRoute({ loaderData }: Route.ComponentProps) {
  return <StockDetail initialDetail={loaderData.detail} initialMarkers={loaderData.markers} />
}
