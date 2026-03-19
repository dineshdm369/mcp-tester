import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Play, Clock, GitCompare, Settings, Menu, X } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/run', label: 'Run', icon: Play },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const handleNavClick = (to: string) => {
    setMobileOpen(false)
    navigate(to)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-12">
          {/* Wordmark */}
          <span className="font-display font-bold text-xs tracking-[0.2em] uppercase text-zinc-100 shrink-0">
            mcp<span className="text-cyan-400">-</span>tester
          </span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 ml-auto">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-1.5 px-3 py-2 text-[11px] font-display font-medium tracking-[0.12em] uppercase rounded transition-colors',
                    isActive
                      ? 'text-cyan-400 bg-cyan-400/8'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900',
                  )
                }
              >
                <Icon size={12} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-auto text-zinc-400 hover:text-zinc-200 p-1.5 rounded transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950/98">
            <nav className="max-w-7xl mx-auto px-4 py-2 flex flex-col gap-0.5">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => handleNavClick(to)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-3 text-sm font-display font-medium tracking-[0.08em] uppercase rounded transition-colors',
                      isActive
                        ? 'text-cyan-400 bg-cyan-400/8'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900',
                    )
                  }
                >
                  <Icon size={14} strokeWidth={2} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
