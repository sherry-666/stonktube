import type { Route } from './+types/creators.$slug.js'
import { apiFetch } from '../api/client.js'
import type { CreatorProfile } from '../api/hooks.js'
import CreatorProfileScreen from '../screens/CreatorProfile.js'

export async function loader({ params, request }: Route.LoaderArgs) {
  const lang = new URL(request.url).searchParams.get('lang') ?? 'en'
  const qs = lang !== 'en' ? `?lang=${lang}` : ''
  const creator = await apiFetch<CreatorProfile>(`/api/creators/${params.slug}${qs}`)
  return { creator }
}

export function meta({ data }: Route.MetaArgs) {
  const creator = data?.creator
  const title = creator
    ? `${creator.name} Stock & Crypto Picks · StonkTube`
    : 'Creator · StonkTube'
  const description = creator
    ? `See which stocks and crypto assets ${creator.name} covers on YouTube. Track their investment calls, bullish/bearish ratings, and sentiment history on StonkTube.`
    : 'YouTube finance creator picks and sentiment on StonkTube.'
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
  ]
}

export default function CreatorProfileRoute({ loaderData }: Route.ComponentProps) {
  return <CreatorProfileScreen initialCreator={loaderData.creator} />
}
