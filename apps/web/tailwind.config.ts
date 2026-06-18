import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page / surface
        page: '#F6F6F2',
        card: '#FFFFFF',
        tile: '#F8F8F4',
        divider: '#F0EFE8',
        separator: '#F3F2EC',
        // Text
        primary: '#14151A',
        body: '#23242B',
        muted: '#6E6F78',
        faint: '#9A9BA4',
        faintest: '#B6B7BE',
        // Borders
        border: '#ECEBE4',
        'border-hover': '#D6D5CC',
        // Accent
        accent: '#4F46E5',
        'accent-hover': '#3730A3',
        // Sentiment
        bull: { DEFAULT: '#0F9D63', bg: '#E7F6EE' },
        bear: { DEFAULT: '#E5484D', bg: '#FCEBEC' },
        neutral: { DEFAULT: '#D9B26A', bg: '#FBF3E2' },
        // Brand mark
        brand: { DEFAULT: '#23D17F', dark: '#1AB46B' },
        // Private tag
        private: { text: '#8A6D3B', bg: '#FBF3E2' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        pill: '8px',
        input: '10px',
        card: '14px',
        'card-lg': '18px',
        modal: '20px',
        avatar: '50%',
      },
      boxShadow: {
        pill: '0 12px 28px -12px rgba(20,21,26,0.18)',
        modal: '0 30px 80px -20px rgba(20,21,26,0.5)',
        tooltip: '0 12px 32px -8px rgba(20,21,26,0.4)',
      },
      maxWidth: {
        container: '1240px',
      },
      // Stock brand colors (for dynamic use, prefer inline style)
      // Creator brand colors — same
    },
  },
  plugins: [],
} satisfies Config
