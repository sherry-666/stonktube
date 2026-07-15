import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18next from '../i18n.js'

export type Lang = 'en' | 'zh' | 'ko'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
]

export function useLang(): { lang: Lang; switchLang: (l: Lang) => void } {
  const [params, setParams] = useSearchParams()
  const raw = params.get('lang')
  const lang: Lang = raw === 'zh' || raw === 'ko' ? raw : 'en'

  useEffect(() => {
    i18next.changeLanguage(lang)
  }, [lang])

  function switchLang(l: Lang) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (l === 'en') {
        next.delete('lang')
      } else {
        next.set('lang', l)
      }
      return next
    })
  }

  return { lang, switchLang }
}
