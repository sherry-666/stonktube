import { NavLink } from 'react-router-dom'
import { Search } from 'lucide-react'

export default function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary text-white rounded-[8px] px-[13px] py-[7px] font-semibold text-sm leading-none'
      : 'text-muted font-medium text-sm hover:text-primary transition-colors duration-150 px-[13px] py-[7px]'

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: 'rgba(246,246,242,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div className="mx-auto flex max-w-container items-center gap-7 px-7" style={{ height: 66 }}>
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/icon.svg" alt="StonkTube" className="h-[30px] w-[30px] rounded-[9px]" />
          <span className="font-display font-bold text-[19px] tracking-[-0.02em] text-primary">
            StonkTube
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/stocks" className={linkClass}>Stocks</NavLink>
          <NavLink to="/creators" className={linkClass}>Creators</NavLink>
        </nav>

        {/* Search */}
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={14} />
          <input
            type="search"
            placeholder="Search ticker or creator"
            className="w-[230px] rounded-[10px] border border-border bg-white pl-8 pr-3 py-2 text-sm text-primary placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
    </header>
  )
}
