/**
 * Seeds the DB from the prototype dataset in design/TickerTube.dc.html.
 * Safe to re-run: uses upserts on natural keys.
 */
import { connectDB, disconnectDB } from './connection.js'
import { Creator } from './models/Creator.js'
import { Stock } from './models/Stock.js'
import { Video } from './models/Video.js'
import { deletePricesForStock, insertPrices } from './pricePoints.js'
import { rebuildStats } from './rollup.js'
import { ensureIndexes } from './bootstrap.js'

const CREATORS = [
  { slug: 'bella', name: 'Bella Finance', handle: '@bellafinance', brandColor: '#DB2D7A', initial: 'B', youtubeChannelId: 'UC_bella', channelUrl: 'https://youtube.com/@bellafinance', subscriberCount: 612000, bio: 'Beginner-friendly breakdowns of growth and tech stocks for new investors.', language: 'en' },
  { slug: 'mei', name: 'MeiTouJun', handle: '@MeiTouJun', brandColor: '#E0962B', initial: '美', youtubeChannelId: 'UC_mei', channelUrl: 'https://youtube.com/@MeiTouJun', subscriberCount: 1200000, bio: 'In-depth Chinese-language analysis of US tech, AI, and semiconductor names.', language: 'zh' },
  { slug: 'joseph', name: 'Joseph Carlson', handle: '@JosephCarlson', brandColor: '#2563EB', initial: 'J', youtubeChannelId: 'UC_joseph', channelUrl: 'https://youtube.com/@JosephCarlson', subscriberCount: 843000, bio: 'Long-term compounding and quality-business investing, one portfolio update at a time.', language: 'en' },
  { slug: 'andrei', name: 'Andrei Jikh', handle: '@AndreiJikh', brandColor: '#7C3AED', initial: 'A', youtubeChannelId: 'UC_andrei', channelUrl: 'https://youtube.com/@AndreiJikh', subscriberCount: 2300000, bio: 'Dividends, growth bets, and pre-IPO opportunities explained simply.', language: 'en' },
  { slug: 'tom', name: 'Tom Nash', handle: '@TomNash', brandColor: '#0D9488', initial: 'T', youtubeChannelId: 'UC_tom', channelUrl: 'https://youtube.com/@TomNash', subscriberCount: 498000, bio: 'Contrarian takes and risk-first stock breakdowns — the bear case nobody wants.', language: 'en' },
  { slug: 'kevin', name: 'Meet Kevin', handle: '@MeetKevin', brandColor: '#EA580C', initial: 'K', youtubeChannelId: 'UC_kevin', channelUrl: 'https://youtube.com/@MeetKevin', subscriberCount: 2100000, bio: 'High-conviction macro and momentum calls with daily market coverage.', language: 'en' },
]

const STOCKS = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Semiconductors', brandColor: '#76B900', logoBg: '#1A1A1A', initials: 'NV', aliases: ['Nvidia', 'NVIDIA', '英伟达'] },
  { ticker: 'GOOGL', name: 'Alphabet Inc', sector: 'Internet', brandColor: '#4285F4', logoBg: '#4285F4', initials: 'GO', aliases: ['Google', 'Alphabet', '谷歌'] },
  { ticker: 'COIN', name: 'Coinbase Global', sector: 'Crypto Exchange', brandColor: '#0052FF', logoBg: '#0052FF', initials: 'CO', aliases: ['Coinbase'] },
  { ticker: 'SPACEX', name: 'SpaceX', sector: 'Aerospace', brandColor: '#5B6BD6', logoBg: '#15172B', initials: 'SX', aliases: ['Space X', '星链'], isPrivate: true },
  { ticker: 'TSLA', name: 'Tesla Inc', sector: 'Autos · Energy', brandColor: '#E31937', logoBg: '#E31937', initials: 'TS', aliases: ['Tesla'] },
  { ticker: 'MSTR', name: 'Strategy', sector: 'Bitcoin Treasury', brandColor: '#F7931A', logoBg: '#0E1B33', initials: 'MS', aliases: ['MicroStrategy', 'Strategy', '微策略'] },
  { ticker: 'BTC-USD', name: 'Bitcoin', sector: 'Cryptocurrency', brandColor: '#F7931A', logoBg: '#1A1A1A', initials: 'BT', aliases: ['Bitcoin', 'BTC', '比特币', 'bitcoin'] },
  { ticker: 'ETH-USD', name: 'Ethereum', sector: 'Cryptocurrency', brandColor: '#627EEA', logoBg: '#1A1A1A', initials: 'ET', aliases: ['Ethereum', 'ETH', '以太坊', 'ethereum'] },
  { ticker: 'GLD', name: 'Gold', sector: 'Commodity', brandColor: '#FFD700', logoBg: '#1A1A1A', initials: 'AU', aliases: ['Gold', 'gold', '黄金', 'XAUUSD'] },
]

// Stock price generation configs
const STOCK_CONFIGS: Record<string, { seed: number; start: number; drift: number; vol: number }> = {
  NVDA: { seed: 11, start: 118, drift: 0.0018, vol: 0.05 },
  GOOGL: { seed: 22, start: 152, drift: 0.001, vol: 0.034 },
  COIN: { seed: 33, start: 205, drift: 0.0017, vol: 0.072 },
  SPACEX: { seed: 44, start: 150, drift: 0.0016, vol: 0.026 },
  TSLA: { seed: 55, start: 300, drift: 0.0006, vol: 0.06 },
  MSTR: { seed: 66, start: 1300, drift: 0.0021, vol: 0.092 },
  'BTC-USD': { seed: 77, start: 95000, drift: 0.0015, vol: 0.06 },
  'ETH-USD': { seed: 88, start: 3200, drift: 0.0012, vol: 0.07 },
  GLD: { seed: 99, start: 230, drift: 0.0003, vol: 0.012 },
}

// Prototype PRNG
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Build 260 trading days back from today (skip weekends), oldest first
function tradingDays(count: number): Date[] {
  const days: Date[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (days.length < count) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  days.reverse()
  return days
}

// Video title hash for durationSeconds
function titleHash(title: string): number {
  return title.split('').reduce((h, c) => (h + c.charCodeAt(0) * 7) | 0, 0)
}

// Prototype video data: [creator_slug, days_ago, title, [[ticker, sentiment]]]
const VIDEOS: [string, number, string, [string, string][]][] = [
  ['bella', 3, "NVIDIA's next leg up? Blackwell demand is off the charts", [['NVDA', 'BULLISH'], ['GOOGL', 'BULLISH']]],
  ['kevin', 4, 'Coinbase to new highs if Bitcoin holds — plus my full crypto basket', [['COIN', 'BULLISH'], ['MSTR', 'BULLISH']]],
  ['joseph', 5, 'Alphabet is still the cheapest Big Tech name', [['GOOGL', 'BULLISH'], ['NVDA', 'NEUTRAL']]],
  ['andrei', 6, 'How to actually invest in SpaceX before the IPO', [['SPACEX', 'BULLISH']]],
  ['tom', 7, 'Tesla deliveries are slowing — here\'s the data', [['TSLA', 'BEARISH']]],
  ['kevin', 8, 'Strategy is a leveraged Bitcoin bet — and that\'s the point', [['MSTR', 'BULLISH'], ['COIN', 'BULLISH']]],
  ['mei', 9, '英伟达还能追吗？最新财报与估值全解读', [['NVDA', 'BULLISH']]],
  ['bella', 14, "Is Google's ad business in trouble? Let's look", [['GOOGL', 'NEUTRAL']]],
  ['kevin', 16, 'Why Tesla is still a robotaxi call option', [['TSLA', 'BULLISH']]],
  ['joseph', 17, 'Why I trimmed my NVDA position (but didn\'t sell)', [['NVDA', 'NEUTRAL']]],
  ['tom', 19, 'Coinbase margins are getting squeezed', [['COIN', 'BEARISH']]],
  ['kevin', 21, 'SpaceX secondary shares — is the valuation justified?', [['SPACEX', 'BULLISH']]],
  ['tom', 27, 'The MSTR premium makes no sense to me', [['MSTR', 'BEARISH'], ['COIN', 'BEARISH']]],
  ['andrei', 29, 'My updated price targets after the AI capex wave', [['NVDA', 'BULLISH'], ['GOOGL', 'BULLISH']]],
  ['andrei', 33, 'Why GOOGL is my largest position right now', [['GOOGL', 'BULLISH']]],
  ['bella', 38, 'COIN earnings breakdown — what actually matters', [['COIN', 'NEUTRAL']]],
  ['joseph', 40, "I don't own Tesla — here's my honest take", [['TSLA', 'NEUTRAL']]],
  ['mei', 44, '星链估值飙升，SpaceX 还有多少空间', [['SPACEX', 'BULLISH']]],
  ['tom', 46, 'The NVIDIA setup nobody is talking about', [['NVDA', 'BEARISH']]],
  ['mei', 55, '微策略：比特币的杠杆代理', [['MSTR', 'BULLISH']]],
  ['mei', 58, '谷歌：被低估的AI赢家', [['GOOGL', 'BULLISH'], ['NVDA', 'BULLISH']]],
  ['andrei', 64, 'Buying the Coinbase dip again', [['COIN', 'BULLISH']]],
  ['andrei', 68, 'Cutting my Tesla position in half', [['TSLA', 'BEARISH']]],
  ['kevin', 71, 'Loading up on NVDA going into earnings', [['NVDA', 'BULLISH']]],
  ['bella', 79, 'SpaceX: the hype vs the numbers', [['SPACEX', 'NEUTRAL']]],
]

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function run() {
  await connectDB()
  await ensureIndexes()
  console.log('Connected. Seeding...')

  // Upsert creators
  const creatorDocs: Record<string, InstanceType<typeof Creator>> = {}
  for (const c of CREATORS) {
    const doc = await Creator.findOneAndUpdate(
      { slug: c.slug },
      { $set: c },
      { upsert: true, new: true },
    )
    creatorDocs[c.slug] = doc!
  }
  console.log(`Upserted ${CREATORS.length} creators`)

  // Upsert stocks
  const stockDocs: Record<string, InstanceType<typeof Stock>> = {}
  for (const s of STOCKS) {
    const doc = await Stock.findOneAndUpdate(
      { ticker: s.ticker },
      { $set: s },
      { upsert: true, new: true },
    )
    stockDocs[s.ticker] = doc!
  }
  console.log(`Upserted ${STOCKS.length} stocks`)

  // Upsert videos with embedded mentions
  let videoCount = 0
  for (const [creatorSlug, ago, title, mentionPairs] of VIDEOS) {
    const creator = creatorDocs[creatorSlug]
    if (!creator) continue

    const ytId = `seed_${creatorSlug}_${ago}`
    const mentions = mentionPairs.map(([ticker, sentiment], i) => ({
      stockId: stockDocs[ticker]._id,
      ticker,
      sentiment,
      isPrimary: i === 0,
      note: '',
    }))

    const h = titleHash(title)
    const durationSeconds = (8 + (Math.abs(h) % 16)) * 60 + (Math.abs(h) % 60)

    await Video.findOneAndUpdate(
      { youtubeVideoId: ytId },
      {
        $set: {
          creatorId: creator._id,
          creator: {
            slug: creator.slug,
            name: creator.name,
            handle: creator.handle,
            brandColor: creator.brandColor,
            initial: creator.initial,
          },
          youtubeVideoId: ytId,
          title,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(creator.name + ' ' + title)}`,
          publishedAt: daysAgo(ago),
          transcriptStatus: 'SKIPPED',
          analysisStatus: 'ANALYZED',
          language: creator.language,
          mentions,
          durationSeconds,
        },
      },
      { upsert: true },
    )
    videoCount++
  }
  console.log(`Upserted ${videoCount} videos`)

  // Generate price history
  const days = tradingDays(260)
  for (const [ticker, stock] of Object.entries(stockDocs)) {
    const cfg = STOCK_CONFIGS[ticker]
    if (!cfg) continue

    await deletePricesForStock(stock._id)

    const rand = rng(cfg.seed)
    let price = cfg.start
    const points = days.map((date) => {
      const r = rand()
      // GBM step: drift + vol * normalish noise (Box-Muller-ish via two uniform draws)
      const r2 = rand()
      // approximate normal using CLT: average of 6 uniforms scaled
      const noise = (r + r2 - 1) * Math.sqrt(2)
      price = price * Math.exp(cfg.drift + cfg.vol * noise)
      return {
        date,
        meta: { stockId: stock._id, ticker },
        close: Math.round(price * 100) / 100,
        source: 'generated',
      }
    })

    await insertPrices(points)
    console.log(`Inserted ${points.length} price points for ${ticker}`)
  }

  // Rebuild all stock stats
  console.log('Rebuilding stats...')
  await rebuildStats()
  console.log('Stats rebuilt.')

  await disconnectDB()
  console.log('Done.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
