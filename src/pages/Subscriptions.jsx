import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Software Subscription', 'Membership', 'Healthcare',
  'Hosting Service', 'Entertainment', 'Finance', 'Education', 'Other',
]

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
}
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(s) {
  if (!s) return null
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(s) - t) / 86400000)
}
function toMonthly(amount, freq) {
  return freq === 'monthly' ? amount : freq === 'annual' ? amount / 12 : 0
}
function categoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('software') || c.includes('app')) return '💻'
  if (c.includes('member') || c.includes('club')) return '🎫'
  if (c.includes('health')) return '🏥'
  if (c.includes('host') || c.includes('server')) return '🌐'
  if (c.includes('entertain') || c.includes('stream')) return '🎬'
  if (c.includes('finance') || c.includes('bank')) return '🏦'
  if (c.includes('util')) return '⚡'
  if (c.includes('educ') || c.includes('library')) return '📚'
  return '📋'
}

function subsForMonth(subs, yr, mo) {
  return subs.filter(s => {
    if (!s.is_active) return false
    if (s.billing_frequency === 'monthly') return true
    if (s.next_renewal_date) {
      const d = new Date(s.next_renewal_date)
      return d.getFullYear() === yr && d.getMonth() === mo
    }
    return false
  })
}

// Pre-loaded from screenshot — seed button inserts these if table is empty
const SEED = [
  { name: 'Microsoft 365 Family',               category: 'Software Subscription', billing_frequency: 'annual',   next_renewal_date: '2026-05-07', day_of_month: null, amount: 104.99, auto_renew: true,  notes: 'Auto-renew enabled',                          is_active: true  },
  { name: 'Amazon Prime',                        category: 'Membership',            billing_frequency: 'annual',   next_renewal_date: '2026-11-27', day_of_month: null, amount: 95.00,  auto_renew: false, notes: 'Annual membership',                            is_active: true  },
  { name: 'NordVPN',                             category: 'Software Subscription', billing_frequency: 'annual',   next_renewal_date: '2027-02-14', day_of_month: null, amount: 133.78, auto_renew: true,  notes: '1-year plan, auto-renew',                      is_active: true  },
  { name: 'Costco UK Membership',                category: 'Membership',            billing_frequency: 'annual',   next_renewal_date: '2026-07-27', day_of_month: null, amount: 0,      auto_renew: false, notes: 'Cost not listed in email — update when known', is_active: true  },
  { name: 'NHS Prescription PPC',                category: 'Healthcare',            billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: 3,    amount: 11.45,  auto_renew: false, notes: '10 monthly Direct Debit payments',             is_active: true  },
  { name: 'Ultra.cc Hosting',                    category: 'Hosting Service',       billing_frequency: 'fixed',    next_renewal_date: '2026-07-03', day_of_month: null, amount: 23.73,  auto_renew: false, notes: 'Service period end',                           is_active: true  },
  { name: 'Apple iCloud+',                       category: 'Software Subscription', billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: null, amount: 0.99,   auto_renew: true,  notes: 'Payment issue flagged',                        is_active: true  },
  { name: 'Claude Pro (Anthropic)',               category: 'Software Subscription', billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: 28,   amount: 18.00,  auto_renew: true,  notes: 'Active recurring payments',                    is_active: true  },
  { name: 'University of Portsmouth Library',     category: 'Education',             billing_frequency: 'annual',   next_renewal_date: '2026-05-18', day_of_month: null, amount: 0,      auto_renew: false, notes: 'External reader membership — cost unknown',    is_active: true  },
  { name: 'giffgaff',                             category: 'Other',                 billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: 9,    amount: 0,      auto_renew: true,  notes: '18-month contract, 20 GB extra data boost — cost not listed in email', is_active: true },
  { name: 'Vault - Hide Pics App Lock',           category: 'Software Subscription', billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: 25,   amount: 3.49,   auto_renew: true,  notes: 'Google Play — by Wafer Co.',                   is_active: true  },
  { name: 'Ring Solo plan',                       category: 'Other',                 billing_frequency: 'monthly',  next_renewal_date: null,         day_of_month: null, amount: 0,      auto_renew: true,  notes: 'Security subscription — cost and date not in email, check Ring account', is_active: true },
]

// ─── Form ─────────────────────────────────────────────────────────────────────

function SubForm({ editItem, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name:               editItem?.name               || '',
    category:           editItem?.category           || 'Software Subscription',
    billing_frequency:  editItem?.billing_frequency  || 'monthly',
    next_renewal_date:  editItem?.next_renewal_date  || '',
    day_of_month:       editItem?.day_of_month       ?? '',
    amount:             editItem?.amount             || '',
    auto_renew:         editItem?.auto_renew         ?? false,
    notes:              editItem?.notes              || '',
    is_active:          editItem?.is_active          ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...form,
      amount:            parseFloat(form.amount) || 0,
      day_of_month:      form.day_of_month !== '' ? parseInt(form.day_of_month) : null,
      next_renewal_date: form.next_renewal_date || null,
      user_id:           user.id,
    }
    const { error: err } = editItem
      ? await supabase.from('subscriptions').update(payload).eq('id', editItem.id)
      : await supabase.from('subscriptions').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    if (!editItem) setForm({ name: '', category: 'Software Subscription', billing_frequency: 'monthly', next_renewal_date: '', day_of_month: '', amount: '', auto_renew: false, notes: '', is_active: true })
  }

  const isMonthly = form.billing_frequency === 'monthly'

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Service name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} required
          placeholder="e.g. Netflix, Microsoft 365"
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Frequency</label>
          <select value={form.billing_frequency} onChange={e => set('billing_frequency', e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="fixed">Fixed term</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Amount (£)</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required
            placeholder="0.00"
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white" />
        </div>
        <div>
          {isMonthly ? (
            <>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Day of month</label>
              <input type="number" min="1" max="31" value={form.day_of_month} onChange={e => set('day_of_month', e.target.value)}
                placeholder="e.g. 28"
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white" />
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                {form.billing_frequency === 'fixed' ? 'End date' : 'Renewal date'}
              </label>
              <input type="date" value={form.next_renewal_date} onChange={e => set('next_renewal_date', e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white" />
            </>
          )}
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} className="rounded accent-indigo-600" />
          <span className="text-xs text-gray-600 dark:text-slate-400">Auto-renews</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded accent-indigo-600" />
          <span className="text-xs text-gray-600 dark:text-slate-400">Active</span>
        </label>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Notes</label>
        <input value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Optional"
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : editItem ? 'Update' : 'Add Subscription'}
        </button>
        {editItem && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-700">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [subs, setSubs] = useState([])
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { fetchSubs() }, [])

  async function fetchSubs() {
    setLoading(true)
    const [{ data: subsData }, { data: recData }] = await Promise.all([
      supabase.from('subscriptions').select('*').order('name'),
      supabase.from('recurring_payments').select('*, categories(name, color)').order('name'),
    ])
    setSubs(subsData || [])
    setRecurring(recData || [])
    setLoading(false)
  }

  async function seedData() {
    setSeeding(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('subscriptions').insert(SEED.map(s => ({ ...s, user_id: user.id })))
    setSeeding(false)
    fetchSubs()
  }

  async function deleteSub(id) {
    if (!confirm('Delete this subscription?')) return
    await supabase.from('subscriptions').delete().eq('id', id)
    fetchSubs()
  }

  async function toggleActive(item) {
    await supabase.from('subscriptions').update({ is_active: !item.is_active }).eq('id', item.id)
    fetchSubs()
  }

  // ── Totals (subscriptions + recurring DDs/SOs) ──
  const active = subs.filter(s => s.is_active)
  const activeRec = recurring.filter(r => r.is_active)
  const recMonthly = activeRec.reduce((sum, r) => sum + Number(r.amount), 0)
  const monthlyEquiv = active.reduce((sum, s) => sum + toMonthly(s.amount, s.billing_frequency), 0) + recMonthly
  const annualTotal = active.reduce((sum, s) => {
    if (s.billing_frequency === 'monthly') return sum + s.amount * 12
    return sum + s.amount
  }, 0) + recMonthly * 12
  const dueSoonCount = active.filter(s =>
    s.billing_frequency !== 'monthly' && s.next_renewal_date &&
    daysUntil(s.next_renewal_date) !== null &&
    daysUntil(s.next_renewal_date) >= 0 &&
    daysUntil(s.next_renewal_date) <= 30
  ).length

  // ── Upcoming renewals (non-monthly, next 90 days) ──
  const upcoming = active
    .filter(s => s.billing_frequency !== 'monthly' && s.next_renewal_date)
    .map(s => ({ ...s, days: daysUntil(s.next_renewal_date) }))
    .filter(s => s.days !== null && s.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6)

  // ── 12-month timeline from today (subs + recurring combined) ──
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const yr = d.getFullYear(), mo = d.getMonth()
    const mSubs = subsForMonth(active, yr, mo)
    const subTotal = mSubs.reduce((sum, s) => sum + s.amount, 0)
    const total = subTotal + recMonthly
    const allItems = [
      ...mSubs,
      ...activeRec.map(r => ({ ...r, _isRec: true })),
    ]
    return {
      yr, mo,
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      subs: allItems,
      total,
      isCurrent: i === 0,
    }
  })
  const maxMonthTotal = Math.max(...months.map(m => m.total), 1)

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Subscriptions</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">
            Track annual and monthly subscriptions — see what's coming up so you're never caught short
          </p>
        </div>
        {subs.length === 0 && !loading && (
          <button onClick={seedData} disabled={seeding}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700">
            {seeding ? 'Loading…' : '✨ Load my subscriptions'}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <p className="text-xs text-gray-400 mb-1">Monthly equivalent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(monthlyEquiv)}</p>
          <p className="text-xs text-gray-400">/month across all subs</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
          <p className="text-xs text-gray-400 mb-1">Annual total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(annualTotal)}</p>
          <p className="text-xs text-gray-400">per year</p>
        </div>
        <div className={`rounded-2xl border p-5 ${dueSoonCount > 0 ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'}`}>
          <p className="text-xs text-gray-400 mb-1">Due in 30 days</p>
          <p className={`text-2xl font-bold ${dueSoonCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{dueSoonCount}</p>
          <p className="text-xs text-gray-400">{dueSoonCount === 1 ? 'renewal coming up' : 'renewals coming up'}</p>
        </div>
      </div>

      {/* 12-month timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Next 12 months</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly outgoing — hover a bar to see what's due</p>
        <div className="grid grid-cols-12 gap-1">
          {months.map(m => (
            <div key={`${m.yr}-${m.mo}`} className="flex flex-col items-center group relative">
              <div className="text-xs text-gray-400 mb-1 font-medium leading-tight text-center">{m.label}</div>
              <div className="relative w-full h-20 bg-gray-50 dark:bg-slate-700 rounded-lg flex items-end overflow-hidden cursor-default">
                {m.total > 0 && (
                  <div
                    className="w-full rounded-lg"
                    style={{
                      height: `${Math.max((m.total / maxMonthTotal) * 100, 6)}%`,
                      backgroundColor: m.isCurrent ? '#6366f1' : '#c7d2fe',
                    }}
                  />
                )}
                {/* Tooltip */}
                {m.subs.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-40 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg pointer-events-none">
                    <p className="font-semibold mb-1">{fmt(m.total)}</p>
                    {m.subs.map(s => (
                      <p key={s.id} className="truncate text-gray-300">· {s.name}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 text-center">
                {m.total > 0 ? `£${Math.round(m.total)}` : '—'}
              </div>
              {m.isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming renewals */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Upcoming renewals</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {upcoming.map(s => {
              const urgent = s.days <= 7
              const soon = s.days <= 30
              return (
                <div key={s.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${urgent ? 'border-red-200 dark:border-red-700' : soon ? 'border-amber-200 dark:border-amber-700' : 'border-gray-100 dark:border-slate-700'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{categoryIcon(s.category)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      urgent ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : soon ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    }`}>
                      {s.days === 0 ? 'Today!' : s.days === 1 ? 'Tomorrow' : `${s.days} days`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(s.next_renewal_date)}</p>
                  <p className="text-base font-bold text-gray-800 dark:text-slate-200 mt-2">
                    {s.amount > 0 ? fmt(s.amount) : '? — check email'}
                  </p>
                  {s.auto_renew && <p className="text-xs text-gray-400 mt-0.5">🔄 Auto-renews</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form + List */}
      <div className="grid grid-cols-3 gap-6">
        {/* Add / Edit form */}
        <div className="col-span-1 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 self-start">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {editItem ? 'Edit subscription' : 'Add subscription'}
          </h3>
          <SubForm
            key={editItem?.id || 'new'}
            editItem={editItem}
            onSaved={() => { fetchSubs(); setEditItem(null) }}
            onCancel={() => setEditItem(null)}
          />
        </div>

        {/* Subscription list */}
        <div className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">All subscriptions</h3>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : subs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 text-sm font-medium">No subscriptions yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "Load my subscriptions" above to import your data</p>
            </div>
          ) : (
            <div className="space-y-1">
              {subs.map(s => {
                const days = s.billing_frequency !== 'monthly' && s.next_renewal_date ? daysUntil(s.next_renewal_date) : null
                const urgentFlag = days !== null && days <= 7
                return (
                  <div key={s.id}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 group ${!s.is_active ? 'opacity-40' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
                      {categoryIcon(s.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {s.billing_frequency === 'monthly'
                          ? `Monthly${s.day_of_month ? ` · day ${s.day_of_month}` : ''}`
                          : `${s.billing_frequency === 'fixed' ? 'Ends' : 'Renews'} ${fmtDate(s.next_renewal_date)}`}
                        {s.auto_renew && ' · 🔄'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                        {s.amount > 0 ? fmt(s.amount) : '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.billing_frequency === 'monthly' ? '/mo' : s.billing_frequency === 'annual' ? '/yr' : 'total'}
                      </p>
                    </div>
                    {urgentFlag && (
                      <span className="text-xs text-red-500 font-semibold flex-shrink-0">{days}d</span>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity flex-shrink-0">
                      <button onClick={() => toggleActive(s)}
                        className="text-xs px-2 py-0.5 rounded-full border border-gray-300 dark:border-slate-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-600">
                        {s.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => setEditItem(s)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                      <button onClick={() => deleteSub(s.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                )
              })}

              {/* Direct Debits & Standing Orders — read-only from Recurring page */}
              {activeRec.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-4 pb-2">
                    <div className="flex-1 h-px bg-gray-100 dark:bg-slate-700" />
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide whitespace-nowrap">
                      Direct Debits & Standing Orders
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-slate-700" />
                  </div>
                  {activeRec.map(r => (
                    <div key={r.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50/50 dark:bg-slate-700/30">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${r.type === 'DD' ? 'bg-red-400' : 'bg-amber-400'}`}>
                        {r.type}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{r.name}</p>
                        <p className="text-xs text-gray-400">
                          Monthly · day {r.day_of_month}
                          {r.categories?.name && ` · ${r.categories.name}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{fmt(r.amount)}</p>
                        <p className="text-xs text-gray-400">/mo</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 text-right pt-1">
                    Managed in <a href="/recurring" className="text-indigo-500 hover:underline">Direct Debits →</a>
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
