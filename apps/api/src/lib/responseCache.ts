import type { FastifyInstance } from 'fastify'

// In-memory stale-while-revalidate cache for GET /api/* responses.
//
// Reads from Atlas are bandwidth-bound (~100KB/s), so building the larger
// responses takes seconds — while the data behind them only changes when the
// pipeline/rollup runs. Fresh entries are served directly; stale ones are
// still served immediately and refreshed in the background by re-running the
// route through app.inject() with the bypass header.

const FRESH_MS = 5 * 60_000
// Past this age an entry is too old to serve; the request waits for fresh data.
const MAX_STALE_MS = 60 * 60_000
const MAX_ENTRIES = 1000
const BYPASS_HEADER = 'x-cache-bypass'

// Search keys are unbounded user input; not worth caching.
const UNCACHED_PREFIXES = ['/api/search']

interface Entry {
  payload: string
  contentType: string
  storedAt: number
}

const cache = new Map<string, Entry>()
const refreshing = new Set<string>()

function isCacheable(method: string, url: string): boolean {
  return method === 'GET' && url.startsWith('/api/') && !UNCACHED_PREFIXES.some((p) => url.startsWith(p))
}

function refresh(app: FastifyInstance, url: string): void {
  if (refreshing.has(url)) return
  refreshing.add(url)
  app
    .inject({ method: 'GET', url, headers: { [BYPASS_HEADER]: '1' } })
    .catch((err) => app.log.error({ err, url }, '[responseCache] refresh failed'))
    .finally(() => refreshing.delete(url))
}

export function registerResponseCache(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (!isCacheable(req.method, req.url) || req.headers[BYPASS_HEADER]) return
    const hit = cache.get(req.url)
    if (!hit) return
    const age = Date.now() - hit.storedAt
    if (age > MAX_STALE_MS) return
    if (age > FRESH_MS) refresh(app, req.url)
    reply.header('content-type', hit.contentType).header('x-cache', age > FRESH_MS ? 'STALE' : 'HIT')
    reply.send(hit.payload)
    return reply
  })

  app.addHook('onSend', async (req, reply, payload) => {
    if (
      isCacheable(req.method, req.url) &&
      reply.statusCode === 200 &&
      typeof payload === 'string' &&
      !reply.getHeader('x-cache')
    ) {
      cache.delete(req.url) // re-insert so Map order tracks recency for eviction
      cache.set(req.url, {
        payload,
        contentType: String(reply.getHeader('content-type') ?? 'application/json; charset=utf-8'),
        storedAt: Date.now(),
      })
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
    }
    return payload
  })
}

// Fill the cache for the main list pages so the first visitors after a deploy
// don't pay the cold-read cost. Sequential to avoid saturating the DB link.
export async function warmResponseCache(app: FastifyInstance): Promise<void> {
  for (const lang of ['en', 'zh', 'ko']) {
    const qs = lang === 'en' ? '' : `?lang=${lang}`
    for (const path of ['/api/dashboard', '/api/stocks', '/api/creators']) {
      await app.inject({ method: 'GET', url: `${path}${qs}`, headers: { [BYPASS_HEADER]: '1' } })
    }
  }
}
