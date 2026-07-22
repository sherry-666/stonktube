import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import { connectDB, disconnectDB, Creator } from './index.js'

const UPDATES: { slug: string; subscriberCount?: number; bioI18n: Record<string, string> }[] = [
  {
    slug: 'bella',
    subscriberCount: 203000,
    bioI18n: {
      en: 'Beginner-friendly breakdowns of growth and tech stocks for new investors.',
      zh: '以新手友好的方式解析成长股与科技股，专为新投资者打造。',
      ko: '성장주와 기술주를 초보자도 이해하기 쉽게 분석하는 채널.',
    },
  },
  {
    slug: 'mei',
    bioI18n: {
      en: 'In-depth Chinese-language analysis of US tech, AI, and semiconductor names.',
      zh: '深度分析美国科技、AI 及半导体股票的中文频道。',
      ko: '미국 기술주, AI, 반도체를 심층 분석하는 중국어 채널.',
    },
  },
  {
    slug: 'joseph',
    bioI18n: {
      en: 'Long-term compounding and quality-business investing, one portfolio update at a time.',
      zh: '专注长期复利与优质企业投资，定期更新投资组合。',
      ko: '장기 복리와 우량 기업 투자에 집중하는 포트폴리오 업데이트 채널.',
    },
  },
  {
    slug: 'andrei',
    bioI18n: {
      en: 'Dividends, growth bets, and pre-IPO opportunities explained simply.',
      zh: '以简洁方式讲解股息、成长股投资与 IPO 前机会。',
      ko: '배당금, 성장주, 상장 전 투자 기회를 쉽게 설명하는 채널.',
    },
  },
  {
    slug: 'tom',
    bioI18n: {
      en: 'Fundamental stock analysis and long-term investing insights for retail investors.',
      zh: '面向散户投资者的基本面股票分析与长线投资洞察。',
      ko: '개인 투자자를 위한 기본적 분석과 장기 투자 인사이트 채널.',
    },
  },
  {
    slug: 'kevin',
    bioI18n: {
      en: 'Real estate, stocks, and economic news with fast-paced market commentary.',
      zh: '涵盖房产、股票与财经新闻的快节奏市场点评频道。',
      ko: '부동산, 주식, 경제 뉴스를 빠르게 다루는 시장 해설 채널.',
    },
  },
  {
    slug: 'rhino',
    bioI18n: {
      en: 'Chinese-language global market analysis covering US stocks, macro trends, and investment opportunities.',
      zh: '中文全球市场分析，涵盖美股、宏观趋势与投资机会。',
      ko: '미국 주식, 거시 동향, 투자 기회를 다루는 중국어 글로벌 시장 분석 채널.',
    },
  },
  {
    slug: 'meitou-news',
    bioI18n: {
      en: 'Chinese-language market news and stock commentary for active traders.',
      zh: '面向活跃交易者的中文市场资讯与股票点评频道。',
      ko: '활발한 트레이더를 위한 중국어 시장 뉴스 및 주식 해설 채널.',
    },
  },
  {
    slug: 'marketbeat',
    subscriberCount: 93500,
    bioI18n: {
      en: 'Stock market research and financial analysis covering earnings, analyst ratings, and investment insights.',
      zh: '涵盖财报、分析师评级与投资洞察的股市研究与金融分析频道。',
      ko: '실적, 애널리스트 평가, 투자 인사이트를 다루는 주식 시장 분석 채널.',
    },
  },
  {
    slug: 'moneydo',
    subscriberCount: 1290000,
    bioI18n: {
      en: "Korean-language channel covering economy, US stocks, real estate, and personal finance for everyday investors.",
      zh: '韩语财经频道，涵盖经济、美股、房产及个人理财，专为普通投资者服务。',
      ko: '경제, 미국 주식, 부동산, 재테크를 다루는 한국어 금융 채널.',
    },
  },
  {
    slug: 'sosumonkey',
    subscriberCount: 1150000,
    bioI18n: {
      en: 'Korean-language stock analysis and investing education covering US and global markets.',
      zh: '韩语股票分析与投资教育频道，涵盖美国及全球市场。',
      ko: '미국 및 글로벌 시장을 다루는 한국어 주식 분석 및 투자 교육 채널.',
    },
  },
  {
    slug: 'nana',
    subscriberCount: 315000,
    bioI18n: {
      en: 'Chinese-language US stock analysis and market commentary covering individual stocks, technical analysis, and market trends.',
      zh: '中文美股分析频道，涵盖个股点评、技术分析与市场趋势。',
      ko: '개별 종목, 기술적 분석, 시장 동향을 다루는 중국어 미국 주식 분석 채널.',
    },
  },
  {
    slug: 'bonnie',
    subscriberCount: 444000,
    bioI18n: {
      en: 'Traditional Chinese creator covering crypto, Bitcoin, blockchain, AI stocks, and global markets. Known for interviewing top industry and finance leaders.',
      zh: '台湾财经区块链创作者，深入解析比特币、加密货币、Web3 与全球股市，定期专访业界大咖。',
      ko: '비트코인, 블록체인, AI 주식, 글로벌 시장을 다루는 대만 크리에이터. 업계 리더 인터뷰로 유명.',
    },
  },
]

await connectDB()

for (const { slug, subscriberCount, bioI18n } of UPDATES) {
  const update: Record<string, unknown> = { bioI18n }
  if (subscriberCount !== undefined) update.subscriberCount = subscriberCount

  const res = await Creator.updateOne({ slug }, { $set: update })
  if (res.matchedCount === 0) {
    console.log(`⚠️  ${slug}: not found, skipped`)
  } else {
    console.log(`✓  ${slug}: updated`)
  }
}

await disconnectDB()
