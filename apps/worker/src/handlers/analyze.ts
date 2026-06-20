import { Worker, type Job } from 'bullmq'
import { Video, Stock, Transcript } from '@stonktube/db'
import { pricesQueue } from '@stonktube/pipeline'
import type { AnalyzeJob } from '@stonktube/shared'
import { LLMExtractionSchema, isTooShort } from '@stonktube/shared'
import { getFlashModel, FunctionCallingMode } from '../lib/gemini.js'
import { TokenBucket } from '../lib/token-bucket.js'
import { SchemaType } from '@google/generative-ai'
import type { Types } from 'mongoose'
import YahooFinance from 'yahoo-finance2'
import pino from 'pino'

const yahooFinance = new YahooFinance()

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

/**
 * App-side rate limit for Gemini, whose binding limit is input tokens/min (TPM).
 * We pace every call through a token bucket sized below the quota, charging each
 * call its estimated token cost — so neither many small calls nor a few large
 * ones can exceed the cap. Tunable via env; defaults stay well under 1M TPM.
 */
const GEMINI_TPM = Number(process.env.GEMINI_TPM ?? 1_000_000)
const GEMINI_TPM_SAFETY = Number(process.env.GEMINI_TPM_SAFETY ?? 0.5)
const effectiveTpm = GEMINI_TPM * GEMINI_TPM_SAFETY
// Refill at the sustained per-second rate; allow ~15s of burst slack.
const geminiBucket = new TokenBucket(effectiveTpm * 0.25, effectiveTpm / 60)

/** Rough input-token cost of a request: prompt chars/4 + tool-schema/output overhead. */
function estimateRequestTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4) + 2000
}

/**
 * Transient errors (Gemini 429 rate-limit/quota, 5xx) should be retried rather
 * than permanently marking the video FAILED. The Google SDK surfaces these in
 * the error message (e.g. "[429 Too Many Requests] ... quota").
 */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number; response?: { status?: number } })?.status
    ?? (err as { response?: { status?: number } })?.response?.status
  if (status === 429 || status === 500 || status === 503) return true
  const msg = (err as Error)?.message ?? ''
  return /\b429\b|too many requests|quota|rate limit|exhausted|\b503\b|\b500\b|overloaded|unavailable/i.test(msg)
}

/** Whether the error is specifically a rate-limit/quota (429) we should pause for. */
function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429) return true
  return /\b429\b|too many requests|quota|rate limit|exhausted/i.test((err as Error)?.message ?? '')
}

/** Parse the retry-after hint from a Gemini 429 (retryDelay / "retry in Ns"); ms, or null. */
function parseRetryDelayMs(err: unknown): number | null {
  const msg = (err as Error)?.message ?? ''
  const m = msg.match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s/i) ?? msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i)
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null
}

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
              description:
                "Directional tone toward the asset: BULLISH=positive/buy, BEARISH=negative/sell, NEUTRAL=no clear bias. Note: merely describing a past price move ('it fell 13%') is NOT itself bullish/bearish — judge the creator's actual view.",
            },
            stance: {
              type: SchemaType.STRING,
              enum: ['OPINION', 'FACTUAL'],
              description:
                "OPINION=the creator gives their own forward-looking view, prediction, recommendation, or judgment (buy/sell/hold, 'this will run', 'overvalued'). FACTUAL=the creator only reports facts (past/current price moves, earnings numbers, news) without taking a side of their own.",
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
          required: ['ticker', 'sentiment', 'stance', 'confidence', 'relevance', 'note', 'isPrimary'],
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

export async function handleAnalyze(job: Job<AnalyzeJob>, worker?: Worker) {
  const { videoId, force } = job.data

  const [video, transcript] = await Promise.all([
    Video.findById(videoId),
    Transcript.findOne({ videoId }),
  ])

  if (!video) throw new Error(`Video not found: ${videoId}`)
  if (!transcript) throw new Error(`No transcript for video: ${videoId}`)

  // Safety net: never analyze a Short / trivial clip (discovery already skips
  // these, but guard against any that predate the duration gate).
  if (isTooShort(video.durationSeconds)) {
    log.info({ videoId, durationSeconds: video.durationSeconds }, 'Too short — skipping analysis')
    await video.updateOne({ analysisStatus: 'NO_MENTIONS', mentions: [] })
    return
  }

  if (video.analysisStatus === 'ANALYZED' && !force) {
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

Set "stance" per mention. If the creator only states facts — e.g. "NVDA fell 13%
along with other semis" or "earnings were up 20%" — that is FACTUAL, even when it
sounds positive or negative. Only mark OPINION when the creator gives their own
forward-looking view, prediction, recommendation, or judgment about the asset.

Video title: ${video.title}

Transcript:
${transcript.text}`

  log.info({ videoId, title: video.title }, 'Sending to Gemini for analysis')

  // Charge the token budget before calling so we stay under Gemini's TPM quota.
  await geminiBucket.acquire(estimateRequestTokens(prompt))

  let result
  try {
    result = await getFlashModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: [EXTRACT_TOOL] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY } },
    })
  } catch (err) {
    // 429 WITH an explicit Retry-After: honor Gemini's hint — pause the whole
    // queue for exactly that long and re-queue without burning an attempt.
    const retryAfterMs = isRateLimited(err) ? parseRetryDelayMs(err) : null
    if (retryAfterMs != null && worker) {
      log.warn({ videoId, pauseMs: retryAfterMs + 1000 }, 'Gemini rate limited (Retry-After) — pausing worker')
      await worker.rateLimit(retryAfterMs + 1000)
      throw Worker.RateLimitError()
    }
    // Otherwise (5xx, or a 429 with no Retry-After hint) retry via BullMQ
    // attempts using exponential backoff WITH jitter (see the analyze worker's
    // backoffStrategy in index.ts), so retries don't synchronize into bursts.
    // Don't burn the video: only mark FAILED on a non-retryable error or once
    // attempts are exhausted, and never for a forced re-analysis.
    const attempts = job.opts.attempts ?? 1
    const isLastAttempt = (job.attemptsMade ?? 0) >= attempts - 1
    if (!isRetryable(err) || isLastAttempt) {
      if (!force) await video.updateOne({ analysisStatus: 'FAILED' })
    } else {
      log.warn(
        { videoId, attempt: (job.attemptsMade ?? 0) + 1, attempts, err: (err as Error).message },
        'Transient analyze error — backing off',
      )
    }
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
        stance: m.stance,
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
