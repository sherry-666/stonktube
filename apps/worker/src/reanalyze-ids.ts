/**
 * Force re-analysis of specific video IDs using the current prompt.
 * Usage: MONGODB_URI=... npx tsx reanalyze-ids.ts <id1> <id2> ...
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

const log = pino({ level: 'info' })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ids = process.argv.slice(2)
if (!ids.length) { console.error('Usage: reanalyze-ids.ts <id1> <id2> ...'); process.exit(1) }

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

for (const id of ids) {
  const video = await Video.findById(id)
  if (!video) { log.warn({ id }, 'Video not found'); continue }

  const transcript = await Transcript.findOne({ videoId: video._id })
  if (!transcript) { log.warn({ id, title: video.title }, 'No transcript'); continue }

  log.info({ id, title: video.title }, 'Reanalyzing')
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
      log.error({ id, err: (err as Error).message }, 'Gemini failed')
      break
    }
  }
  if (!result) continue

  const call = result.response.functionCalls()?.[0]
  const parsed = call?.args ? LLMExtractionSchema.safeParse(call.args) : null
  if (!parsed?.success) { log.warn({ id }, 'Bad LLM output — skipping'); continue }

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

  const opinionCount = resolvedMentions.filter(m => m.stance === 'OPINION').length
  const factualCount = resolvedMentions.filter(m => m.stance === 'FACTUAL').length
  log.info({ id, title: video.title, opinionCount, factualCount }, 'Done')
  if (ids.indexOf(id) < ids.length - 1) await sleep(700)
}

await disconnectDB()
process.exit(0)
