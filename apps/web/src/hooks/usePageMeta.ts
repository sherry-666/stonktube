import { useEffect } from 'react'

const DEFAULT_TITLE = 'StonkTube — YouTube Finance Creator Stock Picks'
const DEFAULT_DESC =
  'Track which stocks YouTube finance creators are calling. Real-time sentiment and ratings from top investing channels.'

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
