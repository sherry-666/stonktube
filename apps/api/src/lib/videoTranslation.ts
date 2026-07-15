import { Video } from '@stonktube/db'
import { translateMany } from './translate.js'

// Accepts the lean() output from Mongoose (FlattenMaps<IVideo>)
interface LeanVideo {
  _id: unknown
  title: string
  summary?: string
  language?: string
  mentions: Array<{ ticker: string; note: string }>
  translations?: Record<string, {
    title?: string
    summary?: string
    notes?: Record<string, string> | Map<string, string>
  }>
}

export interface VideoTranslation {
  title: string
  summary: string
  noteByTicker: Record<string, string>
}

export async function getVideoTranslation(
  video: LeanVideo,
  lang: string,
): Promise<VideoTranslation> {
  const englishNotes: Record<string, string> = {}
  for (const m of video.mentions) {
    if (m.note) englishNotes[m.ticker] = m.note
  }

  const videoLang = video.language ?? 'en'

  // No translation needed when the video is already in the target language
  if (videoLang === lang) {
    return {
      title: video.title,
      summary: video.summary ?? '',
      noteByTicker: englishNotes,
    }
  }

  // Check cache
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

  // Title and summary: translate from the video's actual language → target
  const tickers = Object.keys(englishNotes)
  const [titleResult, summaryResult] = await translateMany(
    [video.title, video.summary ?? ''],
    lang,
    videoLang,
  )

  // Notes are always in English regardless of video language
  const translatedNotes = lang === 'en'
    ? tickers.map(tk => englishNotes[tk])
    : await translateMany(tickers.map(tk => englishNotes[tk]), lang, 'en')

  const title = titleResult ?? video.title
  const summary = summaryResult ?? video.summary ?? ''
  const noteByTicker: Record<string, string> = {}
  tickers.forEach((tk, i) => {
    noteByTicker[tk] = translatedNotes[i] ?? englishNotes[tk]
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
