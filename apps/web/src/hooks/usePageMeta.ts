import { useEffect } from 'react'

const DEFAULT_TITLE = 'StonkTube — Stock & Crypto Picks from YouTube Finance Creators'
const DEFAULT_DESC =
  'See what top YouTube finance creators, influencers, and crypto YouTubers are buying and selling. Real-time stock and crypto sentiment from the biggest investing channels.'

function setMeta(selector: string, value: string) {
  const el = document.querySelector<HTMLMetaElement>(selector)
  if (el) el.content = value
}

export function usePageMeta(title?: string, description?: string) {
  const t = title ?? DEFAULT_TITLE
  const d = description ?? DEFAULT_DESC

  useEffect(() => {
    document.title = t
    setMeta('meta[name="description"]', d)
    setMeta('meta[property="og:title"]', t)
    setMeta('meta[property="og:description"]', d)
    setMeta('meta[name="twitter:title"]', t)
    setMeta('meta[name="twitter:description"]', d)
  }, [t, d])
}
