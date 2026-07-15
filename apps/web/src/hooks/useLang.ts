import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import i18next from '../i18n.js'

export type Lang = 'en' | 'zh' | 'ko'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
]

function parseLang(raw: string | null): Lang {
  return raw === 'zh' || raw === 'ko' ? raw : 'en'
}

export function langPath(path: string, lang: Lang): string {
  return lang !== 'en' ? `${path}?lang=${lang}` : path
}

export function useLang(): { lang: Lang; switchLang: (l: Lang) => void } {
  const [params, setParams] = useSearchParams()
  const lang = parseLang(params.get('lang'))

  useEffect(() => {
    i18next.changeLanguage(lang)
  }, [lang])

  function switchLang(l: Lang) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (l === 'en') next.delete('lang')
      else next.set('lang', l)
      return next
    })
  }

  return { lang, switchLang }
}

export function useLangNavigate() {
  const rawNavigate = useNavigate()
  const [params] = useSearchParams()
  const lang = parseLang(params.get('lang'))
  return (path: string) => rawNavigate(langPath(path, lang))
}
