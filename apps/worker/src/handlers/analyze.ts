import type { Job } from 'bullmq'
import { Video, Stock, Transcript } from '@stonktube/db'
import { pricesQueue } from '@stonktube/pipeline'
import type { AnalyzeJob } from '@stonktube/shared'
import { LLMExtractionSchema } from '@stonktube/shared'
import { getFlashModel, FunctionCallingMode } from '../lib/gemini.js'
import { SchemaType } from '@google/generative-ai'
import type { Types } from 'mongoose'
import YahooFinance from 'yahoo-finance2'
import pino from 'pino'

const yahooFinance = new YahooFinance()

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
            relevance: {
              type: SchemaType.STRING,
              enum: ['PASSING', 'MENTIONED', 'DISCUSSED', 'FEATURED'],
              description:
                'How much the creator actually covers this asset: PASSING=named once in passing/a list, no view; MENTIONED=brief comment with a stance but little reasoning; DISCUSSED=several sentences of real analysis/reasoning; FEATURED=a main subject of the video',
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
          required: ['ticker', 'sentiment', 'confidence', 'relevance', 'note', 'isPrimary'],
        },
      },
      summary: {
        type: SchemaType.STRING,
        description: 'One-sentence summary of what the video covers (max 150 chars)',
      },
      new_tickers: {
        type: SchemaType.ARRAY,
        description: 'Tickers significantly mentioned that are NOT in the tracked list above',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            ticker: { type: SchemaType.STRING, description: 'The ticker symbol (e.g. NVDA, BTC-USD)' },
            name: { type: SchemaType.STRING, description: 'Company or asset name (e.g. NVIDIA Corporation)' },
          },
          required: ['ticker', 'name'],
        },
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

Tracked tickers (use these for the mentions array): ${trackedList}

For tickers in the tracked list: add them to mentions with full sentiment analysis.
For significant stocks/crypto/assets NOT in the tracked list: add them to new_tickers (ticker symbol + name only).

Set "relevance" honestly per the definitions, and be conservative: most assets a
creator merely name-drops or lists should be PASSING. Only use DISCUSSED/FEATURED
when the creator gives real reasoning or spends meaningful time on the asset.

Video title: ${video.title}

Transcript:
${transcript.text}`

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

  const { mentions: rawMentions, summary, new_tickers: newTickers } = parsed.data

  // Create Stock entries for tickers Gemini found but we don't track yet
  for (const { ticker, name } of newTickers ?? []) {
    const upper = ticker.toUpperCase()
    if (tickerMap.has(upper.toLowerCase())) continue
    try {
      const quote = await yahooFinance.quote(upper)
      if (!quote) continue
      const resolvedName = quote.shortName ?? quote.longName ?? name
      const stock = await Stock.findOneAndUpdate(
        { ticker: upper },
        {
          $setOnInsert: {
            ticker: upper,
            name: resolvedName,
            sector: (quote as any).sector ?? '',
            aliases: [],
            isPrivate: false,
            brandColor: '#6B7280',
            logoBg: '#F3F4F6',
            initials: upper.slice(0, 4),
          },
        },
        { upsert: true, new: true },
      )
      if (stock) {
        tickerMap.set(upper.toLowerCase(), stock)
        stocks.push(stock)
        log.info({ ticker: upper, name: resolvedName }, 'Auto-created new stock from video mention')
      }
    } catch (err) {
      log.warn({ ticker, err: (err as Error).message }, 'Could not validate new ticker via Yahoo Finance — skipping')
    }
  }

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
        relevance: m.relevance,
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
