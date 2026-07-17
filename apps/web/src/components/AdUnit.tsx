import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { adsbygoogle: unknown[] }
}

interface AdUnitProps {
  slot: string
  format?: string
  layoutKey?: string
  className?: string
  onHidden?: () => void
}

export default function AdUnit({ slot, format = 'auto', layoutKey, className, onHidden }: AdUnitProps) {
  const insRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}

    const timer = setTimeout(() => {
      const el = insRef.current
      if (!el) return
      if (el.getAttribute('data-ad-status') !== 'filled') {
        setHidden(true)
        onHidden?.()
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (hidden) return null

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle${className ? ` ${className}` : ''}`}
      style={{ display: 'block', minHeight: 100, maxHeight: 120 }}
      data-ad-client="ca-pub-3146668424927503"
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : { 'data-full-width-responsive': 'true' })}
    />
  )
}
