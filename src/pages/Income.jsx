import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount || 0)
}

const SOURCES = ['Salary', 'Freelance', 'Benefits', 'Rental', 'Investments', 'Gift', 'Other']

function IncomeForm({ onSaved, editItem, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: editItem?.date || today,
    amount: editItem?.amount || '',
    source: editItem?.source || 'Salary',
    notes: editItem?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { ...form, amount: parseFloat(form.amount), user_id: user.id }

    let error
    if (editItem) {
      ({ error } = await supabase.from('income_entries').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('income_entries').insert(payload))
    }

    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
    if (!editItem) setForm({ date: today, amount: '', source: 'Salary', notes: '' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (£)</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
        <select value={form.source} onChange={e => set('source', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Optional note"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving...' : editItem ? 'Update' : 'Add Income'}
        </button>
        {editItem && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default function Income() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [showMobileForm, setShowMobileForm] = useState(false)

  useEffect(() => { fetchEntries() }, [year, month])

  async function fetchEntries() {
    setLoading(true)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase.from('income_entries')
      .select('*').gte('date', start).lte('date', end)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this income entry?')) return
    await supabase.from('income_entries').delete().eq('id', id)
    fetchEntries()
  }

  const total = entries.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Income</h2>
          <p className="text-gray-500 text-sm mt-0.5">Track what you earn each month</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowMobileForm(true); setEditItem(null) }}
            className="md:hidden px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Add
          </button>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`col-span-1 bg-white rounded-2xl border border-gray-200 p-6 self-start ${showMobileForm || editItem ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editItem ? 'Edit Entry' : 'Add Income'}</h3>
            <button onClick={() => { setShowMobileForm(false); setEditItem(null) }}
              className="md:hidden text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <IncomeForm
            key={editItem?.id || 'new'}
            onSaved={() => { fetchEntries(); setShowMobileForm(false) }}
            editItem={editItem}
            onCancel={() => { setEditItem(null); setShowMobileForm(false) }}
          />
        </div>

        <div className={`md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 ${showMobileForm || editItem ? 'hidden md:block' : 'block'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{MONTHS[month - 1]} {year}</h3>
            <span className="text-sm font-semibold text-green-700">Total: {fmt(total)}</span>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">💰</div>
              <p className="text-sm">No income recorded this month</p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map(e => (
                <div key={e.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.source}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(e.date).toLocaleDateString('en-GB')}
                      {e.notes && ` · ${e.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-green-700">{fmt(e.amount)}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button onClick={() => { setEditItem(e); setShowMobileForm(true) }} className="text-xs text-indigo-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
