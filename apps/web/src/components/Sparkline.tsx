interface SparklineProps {
  points: number[]
  /** Pass a fixed pixel width, or omit to make the SVG fill 100% of its container */
  width?: number
  height?: number
  color: string
}

export default function Sparkline({ points, width, height = 26, color }: SparklineProps) {
  const VB_W = 100 // internal viewBox width — we always scale in 0‥100 space
  const VB_H = height

  if (!points || points.length < 2) {
    return (
      <svg
        width={width ?? undefined}
        height={height}
        style={width == null ? { display: 'block', width: '100%' } : { display: 'block' }}
      />
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * VB_W
    const y = VB_H - ((v - min) / range) * VB_H
    return `${x},${y}`
  }).join(' ')

  return (
    <svg
      width={width ?? undefined}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={width == null ? { display: 'block', width: '100%' } : { display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
