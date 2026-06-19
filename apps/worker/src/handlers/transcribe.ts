import type { Job } from 'bullmq'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { tmpdir } from 'os'
import { unlink, access } from 'fs/promises'
import { Video, Transcript } from '@stonktube/db'
import { analyzeQueue } from '@stonktube/pipeline'
import type { TranscribeJob } from '@stonktube/shared'
import { YoutubeTranscript } from 'youtube-transcript'
import { getFileManager, getFlashModel } from '../lib/gemini.js'
import pino from 'pino'

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' })
const execFileAsync = promisify(execFile)

async function fetchYouTubeCaptions(youtubeVideoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(youtubeVideoId)
    if (!segments || segments.length === 0) return null
    return segments.map(s => s.text).join(' ')
  } catch {
    return null
  }
}

async function downloadAudio(youtubeVideoId: string): Promise<string> {
  const outPath = join(tmpdir(), `stonktube-${youtubeVideoId}.mp3`)
  await execFileAsync('yt-dlp', [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '-o', outPath,
    '--no-playlist',
    `https://www.youtube.com/watch?v=${youtubeVideoId}`,
  ])
  return outPath
}

async function transcribeWithGemini(audioPath: string): Promise<string> {
  const uploadResult = await getFileManager().uploadFile(audioPath, {
    mimeType: 'audio/mpeg',
    displayName: 'video-audio',
  })

  try {
    const result = await getFlashModel().generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      {
        text: 'Transcribe this audio verbatim. Return only the spoken words with no timestamps, speaker labels, or formatting.',
      },
    ])
    return result.response.text()
  } finally {
    await getFileManager().deleteFile(uploadResult.file.name).catch(() => undefined)
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

  // 2. Fall back: download audio → Gemini transcription
  if (!text) {
    log.info({ videoId }, 'Captions not available — using Gemini audio fallback')
    let audioPath: string | undefined
    try {
      audioPath = await downloadAudio(video.youtubeVideoId)
      text = await transcribeWithGemini(audioPath)
      source = 'GEMINI'
      log.info({ videoId }, 'Gemini transcription complete')
    } finally {
      if (audioPath) {
        await access(audioPath).then(() => unlink(audioPath!)).catch(() => undefined)
      }
    }
  }

  if (!text || text.trim().length < 20) {
    await video.updateOne({ transcriptStatus: 'FAILED' })
    throw new Error(`Transcript too short or empty for video ${videoId}`)
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
