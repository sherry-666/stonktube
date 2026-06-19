import type { Job } from 'bullmq'
import { Video, Stock, Transcript } from '@stonktube/db'
import { pricesQueue } from '@stonktube/pipeline'
import type { AnalyzeJob } from '@stonktube/shared'
import { LLMExtractionSchema } from '@stonktube/shared'
import { getFlashModel, FunctionCallingMode } from '../lib/gemini.js'
import { SchemaType } from '@google/generative-ai'
import type { Types } from 'mongoose'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

const EXTRACT_TOOL = {
  name: 'extract_stock_mentions',
  description:
    'Extract every stock/crypto/asset mention from a financial YouTube video with creator sentiment.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      mentions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            ticker: { type: SchemaType.STRING, description: 'Ticker from the tracked list' },
            sentiment: {
              type: SchemaType.STRING,
              enum: ['BULLISH', 'NEUTRAL', 'BEARISH'],
              description: "Creator's stance: BULLISH=buy/positive, BEARISH=sell/negative, NEUTRAL=mentioned without clear bias",
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: 'How confident you are 0.0–1.0',
            },
            note: {
              type: SchemaType.STRING,
              description: 'One-sentence reason for the sentiment (max 100 chars)',
            },
            isPrimary: {
              type: SchemaType.BOOLEAN,
              description: 'True if this is the main subject of the video',
            },
          },
          required: ['ticker', 'sentiment', 'confidence', 'note', 'isPrimary'],
        },
      },
      summary: {
        type: SchemaType.STRING,
        description: 'One-sentence summary of what the video covers (max 150 chars)',
      },
    },
    required: ['mentions', 'summary'],
  },
}

export async function handleAnalyze(job: Job<AnalyzeJob>) {
  const { videoId } = job.data

  const [video, transcript] = await Promise.all([
    Video.findById(videoId),
    Transcript.findOne({ videoId }),
  ])

  if (!video) throw new Error(`Video not found: ${videoId}`)
  if (!transcript) throw new Error(`No transcript for video: ${videoId}`)

  if (video.analysisStatus === 'ANALYZED') {
    log.info({ videoId }, 'Already analyzed — skipping')
    return
  }

  const stocks = await Stock.find({})
  const tickerMap = new Map<string, (typeof stocks)[0]>()
  for (const s of stocks) {
    tickerMap.set(s.ticker.toLowerCase(), s)
    for (const alias of s.aliases) tickerMap.set(alias.toLowerCase(), s)
  }

  const trackedList = stocks.map(s => `${s.ticker} (${s.name})`).join(', ')

  const prompt = `You are analyzing a financial YouTube video to extract stock/asset mentions.

Tracked tickers you must use: ${trackedList}
Only extract mentions for tickers in the list above. Ignore all others.

Video title: ${video.title}

Transcript:
${transcript.text.slice(0, 30_000)}`

  log.info({ videoId, title: video.title }, 'Sending to Gemini for analysis')

  let result
  try {
    result = await getFlashModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: [EXTRACT_TOOL] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
    })
  } catch (err) {
    await video.updateOne({ analysisStatus: 'FAILED' })
    throw err
  }

  const call = result.response.functionCalls()?.[0]
  if (!call?.args) {
    await video.updateOne({ analysisStatus: 'NO_MENTIONS' })
    return
  }

  const parsed = LLMExtractionSchema.safeParse(call.args)
  if (!parsed.success) {
    log.warn({ videoId, issues: parsed.error.issues }, 'LLM output failed schema — retrying as NO_MENTIONS')
    await video.updateOne({ analysisStatus: 'NO_MENTIONS' })
    return
  }

  const { mentions: rawMentions, summary } = parsed.data

  if (rawMentions.length === 0) {
    await video.updateOne({ analysisStatus: 'NO_MENTIONS', summary })
    return
  }

  // Deduplicate: keep highest-confidence mention per ticker (prefer isPrimary)
  const bestByTicker = new Map<string, typeof rawMentions[0]>()
  for (const m of rawMentions) {
    const existing = bestByTicker.get(m.ticker)
    if (!existing || m.isPrimary || m.confidence > existing.confidence) {
      bestByTicker.set(m.ticker, m)
    }
  }

  const resolvedMentions = [...bestByTicker.values()]
    .map(m => {
      const stock = tickerMap.get(m.ticker.toLowerCase())
      if (!stock) return null
      return {
        stockId: stock._id as Types.ObjectId,
        ticker: stock.ticker,
        sentiment: m.sentiment,
        confidence: m.confidence,
        note: m.note,
        isPrimary: m.isPrimary,
      }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  await video.updateOne({ analysisStatus: 'ANALYZED', summary, mentions: resolvedMentions })
  log.info({ videoId, mentions: resolvedMentions.length }, 'Analysis complete')

  // Enqueue price fill for each mentioned public stock
  const uniqueStockIds = [...new Set(resolvedMentions.map(m => m.stockId.toString()))]
  for (const stockId of uniqueStockIds) {
    const stock = stocks.find(s => s._id.toString() === stockId)
    if (stock?.isPrivate) continue
    await pricesQueue.add(
      'fillPrices',
      { stockId },
      { jobId: `prices-${stockId}-${Date.now()}` },
    )
  }
}
