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
    if (!pushed.current) {
      pushed.current = true
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch {}
    }

    const hide = () => {
      setHidden(true)
      onHidden?.()
    }

    const el = insRef.current
    let observer: MutationObserver | undefined
    if (el) {
      observer = new MutationObserver(() => {
        if (el.getAttribute('data-ad-status') === 'unfilled') hide()
      })
      observer.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] })
    }

    const timer = setTimeout(() => {
      if (insRef.current?.getAttribute('data-ad-status') !== 'filled') hide()
    }, 2000)

    return () => {
      observer?.disconnect()
      clearTimeout(timer)
    }
  }, [])

  if (hidden) return null

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle${className ? ` ${className}` : ''}`}
      style={{ display: 'block' }}
      data-ad-client="ca-pub-3146668424927503"
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : { 'data-full-width-responsive': 'true' })}
    />
  )
}
