import type { Route } from './+types/creators.js'
import { apiFetch } from '../api/client.js'
import type { CreatorCard } from '../api/hooks.js'
import Creators from '../screens/Creators.js'

export async function loader({ request }: Route.LoaderArgs) {
  const lang = new URL(request.url).searchParams.get('lang') ?? 'en'
  const qs = lang !== 'en' ? `?lang=${lang}` : ''
  const data = await apiFetch<CreatorCard[]>(`/api/creators${qs}`)
  return { data }
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: 'YouTube Finance Creators & Influencers · StonkTube' },
    { name: 'description', content: 'Discover YouTube finance creators, influencers, and crypto YouTubers. See which stocks and crypto they cover and track their sentiment ratings.' },
    { property: 'og:title', content: 'YouTube Finance Creators & Influencers · StonkTube' },
    { property: 'og:description', content: 'Discover YouTube finance creators and track their stock picks and sentiment ratings.' },
  ]
}

export default function CreatorsRoute({ loaderData }: Route.ComponentProps) {
  return <Creators initialData={loaderData.data} />
}
