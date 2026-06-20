// Browser-safe env access (this module is re-exported into the web bundle).
const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>

/**
 * Minimum video length we ingest/analyze. Shorts and trivial clips below this
 * are skipped at discovery and excluded from stats. Tunable via env.
 */
export const MIN_VIDEO_SECONDS = Number(env.MIN_VIDEO_SECONDS ?? 30)

/** A known-short video (duration set and under the floor). Unknown duration is not short. */
export function isTooShort(durationSeconds?: number | null): boolean {
  return durationSeconds != null && durationSeconds < MIN_VIDEO_SECONDS
}

/**
 * Parse an ISO-8601 duration (YouTube's contentDetails.duration, e.g. "PT1M30S",
 * "PT45S", "PT1H2M3S") into whole seconds. Returns 0 for unparseable input
 * (e.g. a livestream's "P0D").
 */
export function parseIso8601Duration(iso: string): number {
  const m = /^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/.exec(iso)
  if (!m) return 0
  const [, d, h, min, s] = m
  return Math.round(
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0),
  )
}
