import { Video } from '@stonktube/db'
import { translateMany } from './translate.js'

type SupportedLang = 'zh' | 'ko'

function isSupportedLang(lang: string): lang is SupportedLang {
  return lang === 'zh' || lang === 'ko'
}

export interface VideoTranslation {
  title: string
  summary: string
  noteByTicker: Record<string, string>
}

// Accepts the lean() output from Mongoose (FlattenMaps<IVideo>)
interface LeanVideo {
  _id: unknown
  title: string
  summary?: string
  mentions: Array<{ ticker: string; note: string }>
  translations?: Record<string, {
    title?: string
    summary?: string
    notes?: Record<string, string> | Map<string, string>
  }>
}

export async function getVideoTranslation(
  video: LeanVideo,
  lang: string,
): Promise<VideoTranslation> {
  const englishNotes: Record<string, string> = {}
  for (const m of video.mentions) {
    if (m.note) englishNotes[m.ticker] = m.note
  }

  if (!isSupportedLang(lang)) {
    return {
      title: video.title,
      summary: video.summary ?? '',
      noteByTicker: englishNotes,
    }
  }

  const cached = video.translations?.[lang]

  if (cached?.title) {
    const noteByTicker: Record<string, string> = {}
    if (cached.notes) {
      const notes = cached.notes instanceof Map ? Object.fromEntries(cached.notes) : cached.notes
      Object.assign(noteByTicker, notes)
    }
    return {
      title: cached.title,
      summary: cached.summary ?? video.summary ?? '',
      noteByTicker,
    }
  }

  // Translate and cache lazily
  const tickers = Object.keys(englishNotes)
  const textsToTranslate = [video.title, video.summary ?? '', ...tickers.map(tk => englishNotes[tk])]
  const translated = await translateMany(textsToTranslate, lang)

  const title = translated[0] ?? video.title
  const summary = translated[1] ?? video.summary ?? ''
  const noteByTicker: Record<string, string> = {}
  tickers.forEach((tk, i) => {
    noteByTicker[tk] = translated[2 + i] ?? englishNotes[tk]
  })

  // Write-back (fire and forget)
  Video.updateOne(
    { _id: video._id },
    {
      $set: {
        [`translations.${lang}.title`]: title,
        [`translations.${lang}.summary`]: summary,
        [`translations.${lang}.notes`]: noteByTicker,
      },
    },
  ).catch(err => console.error('[videoTranslation] cache write failed', err))

  return { title, summary, noteByTicker }
}
