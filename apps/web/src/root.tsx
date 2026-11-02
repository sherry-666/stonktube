import { Links, Meta, Outlet, Scripts, ScrollRestoration, useSearchParams } from 'react-router'
import type { LinksFunction, MetaFunction } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import Nav from './components/Nav.js'
import VideoSummaryModal from './components/VideoSummaryModal.js'
import './index.css'

const ADSENSE_CLIENT = 'ca-pub-3146668424927503'
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`

export const meta: MetaFunction = () => [
  { title: 'StonkTube — Stock & Crypto Picks from YouTube Finance Creators' },
  { name: 'description', content: 'See what top YouTube finance creators, influencers, and crypto YouTubers are buying and selling. Real-time stock and crypto sentiment from the biggest investing channels.' },
  { name: 'keywords', content: 'stock picks, crypto picks, YouTube finance, finance influencer, finance creator, investing YouTuber, stock sentiment, crypto sentiment, stock analysis' },
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: 'StonkTube' },
  { property: 'og:title', content: 'StonkTube — Stock & Crypto Picks from YouTube Finance Creators' },
  { property: 'og:description', content: 'See what top YouTube finance creators, influencers, and crypto YouTubers are buying and selling. Real-time stock and crypto sentiment from the biggest investing channels.' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'StonkTube — Stock & Crypto Picks from YouTube Finance Creators' },
  { name: 'twitter:description', content: 'See what top YouTube finance creators, influencers, and crypto YouTubers are buying and selling. Real-time stock and crypto sentiment from the biggest investing channels.' },
  {
    'script:ld+json': {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'StonkTube',
      url: 'https://stonktube.app',
      description: 'Track which stocks and crypto assets YouTube finance creators, influencers, and investing YouTubers are calling. Real-time sentiment ratings from top channels.',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://stonktube.app/stocks?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
  },
]

export const links: LinksFunction = () => [
  { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
  { rel: 'preload', as: 'script', href: ADSENSE_SRC, crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
  },
]

function AppShell() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openVideoId = searchParams.get('video')

  function handleModalClose() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('video')
      return next
    })
  }

  return (
    <div className="min-h-screen bg-page">
      <Nav />
      <main className="mx-auto max-w-container px-4 py-6 md:px-7 md:py-8">
        <Outlet />
      </main>
      <VideoSummaryModal videoId={openVideoId} onClose={handleModalClose} />
    </div>
  )
}

export default function Root() {
  const [queryClient] = useState(() => new QueryClient())

  // AdSense inserts its own <script> and <meta> tags into <head> as soon as it runs.
  // React 18 hydrates the whole document, so if that happens before hydration the
  // head no longer matches and the document is re-rendered, dropping styles. Only
  // execute it once hydrated; the preload in `links` keeps the fetch early. AdUnit
  // pushes queue on window.adsbygoogle until then.
  useEffect(() => {
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return
    const script = document.createElement('script')
    script.async = true
    script.src = ADSENSE_SRC
    script.crossOrigin = 'anonymous'
    document.head.appendChild(script)
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
        <Meta />
        <Links />
      </head>
      <body className="bg-page font-body text-primary antialiased">
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
