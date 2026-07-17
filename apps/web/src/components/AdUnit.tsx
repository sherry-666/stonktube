import { useEffect, useRef } from 'react'

declare global {
  interface Window { adsbygoogle: unknown[] }
}

interface AdUnitProps {
  slot: string
  format?: string
  style?: React.CSSProperties
}

export default function AdUnit({ slot, format = 'auto', style }: AdUnitProps) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [])

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', minHeight: 60, ...style }}
      data-ad-client="ca-pub-3146668424927503"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
