export default function TagIcon({ tag }: { tag: string }) {
  const props = { width: 16, height: 16, viewBox: '0 0 64 64', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' }

  switch (tag) {
    case 'crypto':
      return (
        <svg {...props}>
          <circle cx="32" cy="32" r="26" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3.4" />
          <path d="M26 20v24M22 26h12a6 6 0 0 1 0 12H22m0 0h13a6 6 0 0 1 0 12H22" stroke="#1A1A1A" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M29 14v6M36 14v6M29 44v6M36 44v6" stroke="#1A1A1A" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      )
    case 'dividends':
      return (
        <svg {...props}>
          <rect x="14" y="42" width="22" height="12" rx="2.5" fill="#fff" stroke="#1A1A1A" strokeWidth="3.2" />
          <rect x="14" y="30" width="22" height="12" rx="2.5" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3.2" />
          <rect x="14" y="18" width="22" height="12" rx="2.5" fill="#fff" stroke="#1A1A1A" strokeWidth="3.2" />
          <path d="M46 16v20m0 0l-6-6m6 6l6-6" stroke="#16a34a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'macro':
      return (
        <svg {...props}>
          <circle cx="32" cy="32" r="25" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3.4" />
          <path d="M7 32h50M32 7v50" stroke="#1A1A1A" strokeWidth="2.2" />
          <path d="M32 7c9 8 9 42 0 50M32 7c-9 8-9 42 0 50" stroke="#1A1A1A" strokeWidth="2.2" />
          <path d="M9 20h46M9 44h46" stroke="#1A1A1A" strokeWidth="2.2" />
          <path d="M18 40l9-10 8 6 12-15" stroke="#16a34a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'news':
      return (
        <svg {...props}>
          <rect x="12" y="16" width="34" height="34" rx="4" fill="#fff" stroke="#1A1A1A" strokeWidth="3.2" />
          <rect x="46" y="26" width="10" height="24" rx="3" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3.2" />
          <rect x="17" y="21" width="15" height="12" rx="2" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="2.6" />
          <path d="M36 22h6M36 28h6M18 39h24M18 45h16" stroke="#1A1A1A" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )
    case 'politics':
      return (
        <svg {...props}>
          <path d="M16 26h32l-4-8H20l-4 8z" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M32 18v-6M25 12h14" stroke="#1A1A1A" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M20 26v22M44 26v22M26 26v22M32 26v22M38 26v22" stroke="#1A1A1A" strokeWidth="2.6" />
          <rect x="14" y="48" width="36" height="8" rx="2.5" fill="#fff" stroke="#1A1A1A" strokeWidth="3.2" />
        </svg>
      )
    case 'technical':
      return (
        <svg {...props}>
          <path d="M12 52h40" stroke="#1A1A1A" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="18" y="34" width="8" height="14" rx="1.5" fill="#fff" stroke="#1A1A1A" strokeWidth="3" />
          <path d="M22 26v8M22 48v4" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
          <rect x="30" y="26" width="8" height="16" rx="1.5" fill="#DCFCE7" stroke="#1A1A1A" strokeWidth="3" />
          <path d="M34 18v8M34 42v6" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
          <rect x="42" y="32" width="8" height="12" rx="1.5" fill="#fff" stroke="#1A1A1A" strokeWidth="3" />
          <path d="M46 24v8M46 44v4" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
          <path d="M16 22l8-5 10 4 12-9" stroke="#16a34a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
