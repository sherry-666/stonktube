/**
 * Queue-free re-analysis. Re-runs Gemini extraction over already-analyzed videos
 * using the current prompt/tool, so mentions get the new `stance` (OPINION vs
 * FACTUAL) and `relevance` fields. This reclassifies legacy passing/factual
 * references (e.g. "reports Musk's net worth rose", "mentioned in a prior video")
 * so they stop counting toward sentiment.
 *
 * Runs locally with prod env injected (Redis isn't reachable off-Railway, so we
 * skip the price-fill enqueue the queue handler does). Re-run rollup afterwards.
 *
 *   node dist/reanalyze-direct.js [limit]      # limit = max videos (for a test run)
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Stock, Video, Transcript } from '@stonktube/db'
import { LLMExtractionSchema, isTooShort } from '@stonktube/shared'
import { getFlashModel, FunctionCallingMode } from './lib/gemini.js'
import { EXTRACT_TOOL, buildAnalysisPrompt } from './handlers/analyze.js'
import type { Types } from 'mongoose'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity

function isRateLimited(err: unknown): boolean {
  return /\b429\b|too many requests|quota|rate limit|exhausted/i.test((err as Error)?.message ?? '')
}
function retryDelayMs(err: unknown): number {
  const m = (err as Error)?.message?.match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s/i)
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 1000 : 30_000
}

await connectDB()

const stocks = await Stock.find({})
const tickerMap = new Map<string, (typeof stocks)[0]>()
for (const s of stocks) {
  tickerMap.set(s.ticker.toLowerCase(), s)
  for (const alias of s.aliases) tickerMap.set(alias.toLowerCase(), s)
}
const trackedList = stocks.map((s) => `${s.ticker} (${s.name})`).join(', ')

const videos = await Video.find({ analysisStatus: 'ANALYZED' }).sort({ publishedAt: -1 })
log.info({ total: videos.length, limit }, 'Re-analyzing')

let done = 0
let changed = 0
for (const video of videos) {
  if (done >= limit) break
  if (isTooShort(video.durationSeconds)) continue
  const transcript = await Transcript.findOne({ videoId: video._id })
  if (!transcript) continue

  const prompt = buildAnalysisPrompt(trackedList, video.title, transcript.text)

  let result
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      result = await getFlashModel().generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [EXTRACT_TOOL] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
      })
      break
    } catch (err) {
      if (isRateLimited(err) && attempt < 3) {
        const wait = retryDelayMs(err)
        log.warn({ wait }, 'Rate limited — pausing')
        await sleep(wait)
        continue
      }
      log.warn({ videoId: video._id.toString(), err: (err as Error).message }, 'Gemini failed — skipping')
      break
    }
  }
  if (!result) continue

  const call = result.response.functionCalls()?.[0]
  const parsed = call?.args ? LLMExtractionSchema.safeParse(call.args) : null
  if (!parsed?.success) {
    done++
    continue
  }

  const { mentions: rawMentions, summary } = parsed.data
  const bestByTicker = new Map<string, (typeof rawMentions)[0]>()
  for (const m of rawMentions) {
    const existing = bestByTicker.get(m.ticker)
    if (!existing || m.isPrimary || m.confidence > existing.confidence) bestByTicker.set(m.ticker, m)
  }
  const resolvedMentions = [...bestByTicker.values()]
    .map((m) => {
      const stock = tickerMap.get(m.ticker.toLowerCase())
      if (!stock) return null
      return {
        stockId: stock._id as Types.ObjectId,
        ticker: stock.ticker,
        sentiment: m.sentiment,
        confidence: m.confidence,
        relevance: m.relevance,
        stance: m.stance,
        note: m.note,
        isPrimary: m.isPrimary,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  await video.updateOne({ summary, mentions: resolvedMentions })
  changed++
  done++
  if (done % 10 === 0) log.info({ done, changed }, 'progress')
  await sleep(700)
}

log.info({ done, changed }, 'Re-analysis complete')
await disconnectDB()
process.exit(0)
