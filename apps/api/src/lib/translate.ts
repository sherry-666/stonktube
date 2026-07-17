const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2'

async function callTranslateApi(texts: string[], target: string, source?: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) return texts

  const body: Record<string, unknown> = { q: texts, target, format: 'text' }
  if (source) body.source = source

  const res = await fetch(`${TRANSLATE_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`[translate] API error ${res.status}`)
    return texts
  }

  const data = (await res.json()) as {
    data?: { translations?: { translatedText: string }[] }
  }
  return data.data?.translations?.map(t => t.translatedText) ?? texts
}

export async function translateMany(texts: string[], target: string, source?: string): Promise<string[]> {
  if (!texts.length) return texts
  if (source && source === target) return texts
  const nonEmpty = texts.map(t => t || ' ')
  const translated = await callTranslateApi(nonEmpty, target, source)
  return translated.map((t, i) => (texts[i] ? t : ''))
}

export async function translateOne(text: string, target: string, source?: string): Promise<string> {
  if (!text) return text
  if (source && source === target) return text
  const [result] = await callTranslateApi([text], target, source)
  return result ?? text
}
