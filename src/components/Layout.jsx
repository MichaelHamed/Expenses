import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/expenses', label: 'Expenses', icon: '💸' },
  { to: '/income', label: 'Income', icon: '💰' },
  { to: '/recurring', label: 'Direct Debits', icon: '🔄' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/import', label: 'Import', icon: '📥' },
  { to: '/categories', label: 'Categories', icon: '🏷️' },
]

// Bottom nav shows 5 items; the rest go in a "More" drawer
const bottomNav = navItems.slice(0, 4)
const moreItems = navItems.slice(4)

export default function Layout({ session }) {
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Sidebar (desktop only) ───────────────────────────── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">🛡️ My Pocket Guard</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{session?.user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}>
              <span>{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <button onClick={() => setDark(d => !d)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <span>{dark ? '☀️' : '🌙'}</span>{dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
            <span>🚪</span>Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* ── Bottom navigation (mobile only) ──────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-stretch">
          {bottomNav.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-gray-500'
                }`}>
              <span className="text-xl mb-0.5">{icon}</span>
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium text-gray-500">
            <span className="text-xl mb-0.5">☰</span>
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* ── More drawer (mobile) ──────────────────────────────── */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMore(false)} />

          {/* Drawer */}
          <div className="relative bg-white rounded-t-2xl p-5 space-y-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {moreItems.map(({ to, label, icon }) => (
              <NavLink key={to} to={to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                <span className="text-xl">{icon}</span>{label}
              </NavLink>
            ))}

            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <button onClick={() => { setDark(d => !d); setShowMore(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <span className="text-xl">{dark ? '☀️' : '🌙'}</span>
                {dark ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                <span className="text-xl">🚪</span>Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
