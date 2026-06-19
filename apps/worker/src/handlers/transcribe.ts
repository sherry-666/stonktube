import type { Job } from 'bullmq'
import { Video, Transcript } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'
import type { TranscribeJob } from '@stonktube/shared'
import { YoutubeTranscript } from 'youtube-transcript'
import { getFlashModel } from '../lib/gemini.js'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function fetchYouTubeCaptions(youtubeVideoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(youtubeVideoId)
    if (!segments || segments.length === 0) return null
    return segments.map(s => s.text).join(' ')
  } catch {
    return null
  }
}

// Gemini ingests a public YouTube URL directly — Google fetches the video
// server-side, so we avoid yt-dlp/audio downloads (which also get blocked from
// datacenter IPs). Handles videos that have no captions.
async function transcribeFromYouTube(youtubeVideoId: string): Promise<string | null> {
  try {
    const result = await getFlashModel().generateContent([
      {
        fileData: {
          mimeType: 'video/*',
          fileUri: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
        },
      },
      {
        text: 'Transcribe this video verbatim. Return only the spoken words with no timestamps, speaker labels, or formatting.',
      },
    ])
    const text = result.response.text()
    return text && text.trim().length >= 20 ? text : null
  } catch (err) {
    log.warn({ youtubeVideoId, err: (err as Error).message }, 'Gemini YouTube transcription failed')
    return null
  }
}

export async function handleTranscribe(job: Job<TranscribeJob>) {
  const { videoId } = job.data

  const video = await Video.findById(videoId)
  if (!video) throw new Error(`Video not found: ${videoId}`)

  if (video.transcriptStatus === 'CAPTIONS' || video.transcriptStatus === 'TRANSCRIBED') {
    log.info({ videoId }, 'Already transcribed — enqueuing analyze')
    await analyzeQueue.add('analyze', { videoId }, { jobId: `analyze-${videoId}` })
    return
  }

  log.info({ videoId, title: video.title }, 'Transcribing')

  let text: string | null = null
  let source: 'YOUTUBE_CAPTIONS' | 'GEMINI' = 'YOUTUBE_CAPTIONS'

  // 1. Try YouTube captions (fast, free)
  text = await fetchYouTubeCaptions(video.youtubeVideoId)
  if (text) {
    source = 'YOUTUBE_CAPTIONS'
    log.info({ videoId }, 'Got YouTube captions')
  }

  // 2. Fall back: let Gemini transcribe the YouTube video directly
  if (!text) {
    log.info({ videoId }, 'Captions not available — using Gemini YouTube transcription')
    text = await transcribeFromYouTube(video.youtubeVideoId)
    if (text) {
      source = 'GEMINI'
      log.info({ videoId }, 'Gemini transcription complete')
    }
  }

  // 3. Graceful skip: no transcript could be produced. Mark SKIPPED rather than
  // FAILED so BullMQ doesn't retry it forever and it doesn't clog the queue.
  if (!text || text.trim().length < 20) {
    await video.updateOne({ transcriptStatus: 'SKIPPED' })
    log.warn({ videoId }, 'No transcript available — marking SKIPPED')
    return
  }

  await Transcript.findOneAndUpdate(
    { videoId: video._id },
    { videoId: video._id, text, source },
    { upsert: true },
  )

  await video.updateOne({
    transcriptStatus: source === 'YOUTUBE_CAPTIONS' ? 'CAPTIONS' : 'TRANSCRIBED',
  })

  await analyzeQueue.add('analyze', { videoId }, { jobId: `analyze-${videoId}` })
}
