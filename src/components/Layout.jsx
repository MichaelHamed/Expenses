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

// ── Quick-add drawer ─────────────────────────────────────────────────────────
function QuickAddDrawer({ onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ date: today, amount: '', description: '', category_id: '', payment_type: '' })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name').then(({ data }) => setCategories(data || []))
  }, [])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('expenses').insert({
      date: form.date,
      amount: Math.abs(parseFloat(form.amount)),
      description: (form.description || '').substring(0, 500).trim(),
      category_id: form.category_id || null,
      payment_type: form.payment_type || null,
      user_id: user.id,
      source: 'manual',
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(onClose, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-10 shadow-xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add Expense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {done ? (
          <div className="py-10 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-gray-700 font-semibold">Expense saved!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (£)</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required
                  placeholder="0.00" inputMode="decimal"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="e.g. Tesco weekly shop" autoComplete="off"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Uncategorised —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
              <div className="flex gap-2">
                {[['', 'Normal'], ['DD', 'Direct Debit'], ['SO', 'Standing Order']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => set('payment_type', val)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      form.payment_type === val
                        ? val === 'DD' ? 'bg-red-500 text-white border-red-500'
                        : val === 'SO' ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <button type="submit" disabled={saving}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ session }) {
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [showMore, setShowMore] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

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
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-28 md:pb-8">
        <Outlet />
      </main>

      {/* ── Bottom navigation (mobile only) ──────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around px-4 pb-safe">

          {/* Dashboard */}
          <NavLink to="/" end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-3 px-6 text-xs font-medium transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}>
            <span className="text-2xl mb-0.5">📊</span>
            <span>Dashboard</span>
          </NavLink>

          {/* Big + button */}
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex flex-col items-center justify-center -mt-6 w-16 h-16 bg-indigo-600 rounded-full shadow-lg text-white hover:bg-indigo-700 active:scale-95 transition-all">
            <span className="text-3xl leading-none">+</span>
          </button>

          {/* More */}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center justify-center py-3 px-6 text-xs font-medium text-gray-400">
            <span className="text-2xl mb-0.5">☰</span>
            <span>More</span>
          </button>

        </div>
      </nav>

      {/* ── Quick-add drawer (mobile) ─────────────────────────── */}
      {showQuickAdd && <QuickAddDrawer onClose={() => setShowQuickAdd(false)} />}

      {/* ── More drawer (mobile) ──────────────────────────────── */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMore(false)} />
          <div className="relative bg-white rounded-t-2xl p-5 space-y-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2">Pages</p>
            {navItems.map(({ to, label, icon, end }) => (
              <NavLink key={to} to={to} end={end}
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
