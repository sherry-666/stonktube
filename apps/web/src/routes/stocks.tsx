import type { Route } from './+types/stocks.js'
import { apiFetch } from '../api/client.js'
import type { StockRow } from '../api/hooks.js'
import Stocks from '../screens/Stocks.js'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const lang = url.searchParams.get('lang') ?? 'en'
  const qs = lang !== 'en' ? `?lang=${lang}` : ''
  const data = await apiFetch<StockRow[]>(`/api/stocks${qs}`)
  return { data }
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: 'Stocks & Crypto Picks · StonkTube' },
    { name: 'description', content: 'Browse stocks and crypto assets tracked by YouTube finance creators and influencers. Compare sentiment, creator coverage, and price movements.' },
    { property: 'og:title', content: 'Stocks & Crypto Picks · StonkTube' },
    { property: 'og:description', content: 'Browse stocks and crypto assets tracked by YouTube finance creators. Compare sentiment and coverage.' },
  ]
}

export default function StocksRoute({ loaderData }: Route.ComponentProps) {
  return <Stocks initialData={loaderData.data} />
}
