import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../api/client.js'
import StockIcon from './StockIcon.js'
import { useLang, useLangNavigate, langPath, LANGS } from '../hooks/useLang.js'

interface SearchStock {
  ticker: string
  name: string
  brandColor: string
  logoBg: string
  initials: string
  logoUrl?: string
}

interface SearchCreator {
  slug: string
  name: string
  handle: string
  brandColor: string
  initial: string
  avatarUrl?: string
}

interface SearchResults {
  stocks: SearchStock[]
  creators: SearchCreator[]
}

export default function Nav() {
  const navigate = useLangNavigate()
  const { t } = useTranslation()
  const { lang, switchLang } = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary text-white rounded-[8px] px-[13px] py-[7px] font-semibold text-sm leading-none'
      : 'text-muted font-medium text-sm hover:text-primary transition-colors duration-150 px-[13px] py-[7px]'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults(null)
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(val.trim())}`)
        setResults(data)
        setOpen(true)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 280)
  }

  const clear = () => {
    setQuery('')
    setResults(null)
    setOpen(false)
    setLoading(false)
    clearTimeout(debounceRef.current)
  }

  const go = (path: string) => {
    clear()
    navigate(path)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasResults = results && (results.stocks.length > 0 || results.creators.length > 0)
  const showEmpty = open && results && !hasResults && query.trim().length > 0

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: 'rgba(246,246,242,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="mx-auto flex max-w-container flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:flex-nowrap md:gap-7 md:px-7 md:py-0"
        style={{ minHeight: 66 }}
      >
        {/* Logo */}
        <NavLink to={langPath('/', lang)} end className="flex items-center gap-2 shrink-0 order-1 no-underline">
          <img src="/icon.svg" alt="StonkTube" className="h-[30px] w-[30px] rounded-[9px]" />
          <span className="font-display font-bold text-[19px] tracking-[-0.02em] text-primary">
            StonkTube
          </span>
        </NavLink>

        {/* Nav links */}
        <nav className="order-3 flex w-full items-center gap-1 md:order-2 md:w-auto">
          <NavLink to={langPath('/', lang)} end className={linkClass}>{t('nav.dashboard')}</NavLink>
          <NavLink to={langPath('/stocks', lang)} className={linkClass}>{t('nav.stocks')}</NavLink>
          <NavLink to={langPath('/creators', lang)} className={linkClass}>{t('nav.creators')}</NavLink>
        </nav>

        {/* Right side: search + lang switcher */}
        <div className="order-2 ml-auto flex items-center gap-2 min-w-0 md:order-3">
          {/* Search */}
          <div ref={containerRef} className="relative min-w-0 flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" size={14} />
            <input
              type="search"
              value={query}
              onChange={handleChange}
              onFocus={() => { if (results && hasResults) setOpen(true) }}
              onKeyDown={e => { if (e.key === 'Escape') clear() }}
              placeholder={t('nav.search_placeholder')}
              className="w-full md:w-[230px] rounded-[10px] border border-border bg-white pl-8 pr-8 py-2 text-sm text-primary placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
            />
            {query && (
              <button
                onClick={clear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-primary transition-colors"
              >
                <X size={13} />
              </button>
            )}

            {/* Dropdown */}
            {(open && hasResults || showEmpty) && (
              <div
                className="absolute top-full right-0 mt-2 bg-white rounded-xl overflow-hidden w-full md:w-[300px]"
                style={{
                  boxShadow: '0 8px 32px -8px rgba(20,21,26,0.18), 0 0 0 1px #ECEBE4',
                  zIndex: 100,
                }}
              >
                {showEmpty && (
                  <div className="px-4 py-5 text-[13px] text-center text-muted">
                    {t('nav.no_results', { query })}
                  </div>
                )}

                {hasResults && (
                  <>
                    {results!.stocks.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#B6B7BE' }}>
                          {t('nav.section_stocks')}
                        </div>
                        {results!.stocks.map(s => (
                          <button
                            key={s.ticker}
                            onMouseDown={() => go(`/stocks/${s.ticker}`)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors duration-100"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F8F8F4')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <StockIcon
                              logoUrl={s.logoUrl}
                              initials={s.initials}
                              brandColor={s.brandColor}
                              logoBg={s.logoBg}
                              size={32}
                              radius={8}
                              fontSize={11}
                            />
                            <div className="min-w-0">
                              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, fontSize: 13, color: '#14151A' }}>
                                {s.ticker}
                              </div>
                              <div className="text-[11px] truncate" style={{ color: '#9A9BA4' }}>{s.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {results!.creators.length > 0 && (
                      <div className={results!.stocks.length > 0 ? 'border-t border-[#F3F2EC]' : ''}>
                        <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#B6B7BE' }}>
                          {t('nav.section_creators')}
                        </div>
                        {results!.creators.map(c => (
                          <button
                            key={c.slug}
                            onMouseDown={() => go(`/creators/${c.slug}`)}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors duration-100"
                            style={{ background: 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F8F8F4')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {c.avatarUrl ? (
                              <img
                                src={c.avatarUrl}
                                alt={c.name}
                                className="shrink-0 rounded-full object-cover"
                                style={{ width: 32, height: 32 }}
                              />
                            ) : (
                              <div
                                className="flex items-center justify-center shrink-0 rounded-full"
                                style={{ width: 32, height: 32, background: c.brandColor }}
                              >
                                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 13, color: 'white' }}>
                                  {c.initial}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold truncate" style={{ color: '#14151A' }}>{c.name}</div>
                              <div className="text-[11px]" style={{ color: '#9A9BA4' }}>{c.handle}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="h-1.5" />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Language switcher */}
          <div className="flex items-center gap-0.5 shrink-0" style={{ background: '#F0EFE8', borderRadius: 8, padding: '3px 4px' }}>
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                className="px-2 py-1 text-[11px] font-semibold transition-all duration-150"
                style={{
                  borderRadius: 6,
                  background: lang === l.code ? 'white' : 'transparent',
                  color: lang === l.code ? '#14151A' : '#9A9BA4',
                  boxShadow: lang === l.code ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
