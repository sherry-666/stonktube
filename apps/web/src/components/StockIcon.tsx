import { useState } from 'react'

interface StockIconProps {
  logoUrl?: string
  initials: string
  brandColor: string
  logoBg: string
  size: number
  radius: number
  fontSize?: number
}

/**
 * Company logo with a graceful fallback to the brand-colored initials badge
 * when there's no logo URL or the image fails to load (e.g. indices/crypto).
 */
export default function StockIcon({ logoUrl, initials, brandColor, logoBg, size, radius, fontSize }: StockIconProps) {
  const [failed, setFailed] = useState(false)

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={initials}
        onError={() => setFailed(true)}
        className="shrink-0 object-contain"
        style={{ width: size, height: size, borderRadius: radius, background: '#FFFFFF', padding: Math.round(size * 0.12) }}
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: logoBg || '#F0EFE8' }}
    >
      <span
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: fontSize ?? Math.round(size * 0.33),
          color: brandColor || '#14151A',
        }}
      >
        {initials}
      </span>
    </div>
  )
}
