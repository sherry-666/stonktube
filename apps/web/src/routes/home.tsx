import type { Route } from './+types/home.js'
import { apiFetch } from '../api/client.js'
import type { DashboardResponse } from '../api/hooks.js'
import Dashboard from '../screens/Dashboard.js'

export async function loader({ request }: Route.LoaderArgs) {
  const lang = new URL(request.url).searchParams.get('lang') ?? 'en'
  const qs = lang !== 'en' ? `?lang=${lang}` : ''
  const data = await apiFetch<DashboardResponse>(`/api/dashboard${qs}`)
  return { data }
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: 'StonkTube — Stock & Crypto Picks from YouTube Finance Creators' },
    { name: 'description', content: 'See what top YouTube finance creators, influencers, and crypto YouTubers are buying and selling. Real-time stock and crypto sentiment from the biggest investing channels.' },
  ]
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  return <Dashboard initialData={loaderData.data} />
}
