import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { syncToRecurring } from '../lib/syncRecurring'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount || 0)
}

function ExpenseForm({ categories, suggestions, onSaved, editItem, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: editItem?.date || today,
    amount: editItem?.amount || '',
    description: editItem?.description || '',
    category_id: editItem?.category_id || '',
    payment_type: editItem?.payment_type || '',
    notes: editItem?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const descRef = useRef()

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const filteredSuggestions = form.description.trim().length > 0
    ? suggestions.filter(s => s.description.toLowerCase().includes(form.description.toLowerCase())).slice(0, 6)
    : []

  function applySuggestion(s) {
    setForm(f => ({
      ...f,
      description: s.description,
      amount: s.amount,
      category_id: s.category_id || '',
      payment_type: s.payment_type || '',
    }))
    setShowSuggestions(false)
    descRef.current?.blur()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      category_id: form.category_id || null,
      payment_type: form.payment_type || null,
      notes: form.notes || null,
      user_id: user.id,
      source: 'manual',
    }

    let error
    if (editItem) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('expenses').insert(payload))
    }

    setSaving(false)
    if (error) { setError(error.message); return }

    // If marked as DD or SO, sync to recurring_payments
    if (payload.payment_type === 'DD' || payload.payment_type === 'SO') {
      await syncToRecurring([{ ...payload, date: form.date }], user.id)
    }

    onSaved()
    if (!editItem) setForm({ date: today, amount: '', description: '', category_id: '', payment_type: '', notes: '' })
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
      <div className="relative">
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          ref={descRef}
          type="text"
          value={form.description}
          onChange={e => { set('description', e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="e.g. Tesco weekly shop"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoComplete="off"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {filteredSuggestions.map((s, i) => (
              <li key={i}
                onMouseDown={() => applySuggestion(s)}
                className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{s.description}</p>
                  <p className="text-xs text-gray-400">{s.categoryName || 'Uncategorised'}</p>
                </div>
                <span className="text-xs font-semibold text-gray-600 ml-2 flex-shrink-0">
                  £{Number(s.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
        <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">— Uncategorised —</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <div className="flex gap-2">
          {[['', 'Normal'], ['DD', 'Direct Debit'], ['SO', 'Standing Order']].map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => set('payment_type', val)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.payment_type === val
                ? val === 'DD' ? 'bg-red-500 text-white border-red-500'
                : val === 'SO' ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {form.payment_type && form.date && (
          <p className="text-xs text-gray-400 mt-1.5">
            Leaves account on the <strong>{new Date(form.date + 'T12:00:00').getDate()}{['th','st','nd','rd'][((new Date(form.date + 'T12:00:00').getDate() % 100) - 20) % 10] || ['th','st','nd','rd'][(new Date(form.date + 'T12:00:00').getDate() % 100)] || 'th'}</strong> of the month
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">optional</span></label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          rows={2} placeholder="e.g. Birthday dinner, or why this was higher than usual"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : editItem ? 'Update' : 'Add Expense'}
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

export default function Expenses() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchCategories() }, [])
  useEffect(() => { fetchExpenses() }, [year, month])

  async function fetchCategories() {
    const { data: cats } = await supabase.from('categories').select('*').order('name')
    setCategories(cats || [])

    // Build autocomplete suggestions: deduplicated by description, most recent first
    const { data: hist } = await supabase.from('expenses')
      .select('description, amount, category_id, payment_type, categories(name)')
      .not('description', 'is', null)
      .order('date', { ascending: false })
      .limit(500)

    const seen = new Set()
    const deduped = (hist || []).reduce((acc, e) => {
      const key = e.description.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        acc.push({
          description: e.description.trim(),
          amount: e.amount,
          category_id: e.category_id,
          payment_type: e.payment_type,
          categoryName: e.categories?.name || null,
        })
      }
      return acc
    }, [])
    setSuggestions(deduped)
  }

  async function fetchExpenses() {
    setLoading(true)
    setSelected(new Set())
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase.from('expenses')
      .select('*, categories(name, color)')
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
    setSearch('')
    setExpenses(data || [])
    setLoading(false)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    if (!confirm(`Delete ${selected.size} expense${selected.size > 1 ? 's' : ''}?`)) return
    setDeleting(true)
    await supabase.from('expenses').delete().in('id', [...selected])
    setDeleting(false)
    fetchExpenses()
  }

  async function handleBulkCategory(categoryId) {
    if (!selected.size) return
    await supabase.from('expenses')
      .update({ category_id: categoryId || null })
      .in('id', [...selected])
    fetchExpenses()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    fetchExpenses()
  }

  const filtered = expenses.filter(e => {
    if (filterCategory === 'uncategorised' && e.category_id) return false
    if (filterCategory !== 'all' && filterCategory !== 'uncategorised' && e.category_id !== filterCategory) return false
    if (search) {
      const q = search.toLowerCase()
      return (e.description || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q)
    }
    return true
  })

  function exportCSV() {
    const headers = ['Date', 'Description', 'Category', 'Amount (£)', 'Type', 'Notes', 'Source']
    const rows = filtered.map(e => [
      e.date,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.categories?.name || 'Uncategorised').replace(/"/g, '""')}"`,
      Number(e.amount).toFixed(2),
      e.payment_type || '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      e.source || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id))

  function toggleAll() {
    const allVisibleSelected = filtered.every(e => selected.has(e.id))
    setSelected(prev => {
      const next = new Set(prev)
      filtered.forEach(e => allVisibleSelected ? next.delete(e.id) : next.add(e.id))
      return next
    })
  }

  const uncategorisedCount = expenses.filter(e => !e.category_id).length

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
          <p className="text-gray-500 text-sm mt-0.5">Record and manage your spending</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} title="Export to CSV"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Add form */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{editItem ? 'Edit Expense' : 'Add Expense'}</h3>
          <ExpenseForm
            key={editItem?.id || 'new'}
            categories={categories}
            suggestions={suggestions}
            onSaved={fetchExpenses}
            editItem={editItem}
            onCancel={() => setEditItem(null)}
          />
        </div>

        {/* List */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => { setFilterCategory('all'); setSelected(new Set()) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              All ({expenses.length})
            </button>
            <button
              onClick={() => { setFilterCategory('uncategorised'); setSelected(new Set()) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === 'uncategorised' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
              Uncategorised {uncategorisedCount > 0 && `(${uncategorisedCount})`}
            </button>
            {categories.map(c => {
              const count = expenses.filter(e => e.category_id === c.id).length
              if (count === 0) return null
              return (
                <button key={c.id}
                  onClick={() => { setFilterCategory(c.id); setSelected(new Set()) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === c.id ? 'text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
                  style={filterCategory === c.id ? { backgroundColor: c.color } : {}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: filterCategory === c.id ? 'white' : c.color }} />
                  {c.name} ({count})
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {filtered.length > 0 && (
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" title="Select all visible" />
              )}
              <h3 className="font-semibold text-gray-900">
                {filterCategory === 'all' ? `${MONTHS[month - 1]} ${year}` :
                 filterCategory === 'uncategorised' ? 'Uncategorised' :
                 categories.find(c => c.id === filterCategory)?.name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-gray-500 font-medium">{selected.size} selected</span>
                  <select
                    defaultValue=""
                    onChange={e => { handleBulkCategory(e.target.value); e.target.value = '' }}
                    className="border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>Set category…</option>
                    <option value="">— Remove category —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button onClick={handleDeleteSelected} disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors">
                    🗑️ Delete
                  </button>
                </>
              )}
              <span className="text-sm font-semibold text-gray-700">Total: {fmt(total)}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🧾</div>
              <p className="text-sm">{expenses.length === 0 ? 'No expenses this month' : 'No expenses match this filter'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(e => (
                <div key={e.id}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group cursor-pointer ${selected.has(e.id) ? 'bg-indigo-50' : ''}`}
                  onClick={() => toggleSelect(e.id)}
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)}
                      onClick={ev => ev.stopPropagation()}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer flex-shrink-0" />
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: e.categories?.color || '#94a3b8' }} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800">{e.description || '—'}</p>
                        {e.payment_type === 'DD' && <span className="text-xs font-bold text-white bg-red-400 px-1.5 py-0.5 rounded">DD · {new Date(e.date + 'T12:00:00').getDate()}</span>}
                        {e.payment_type === 'SO' && <span className="text-xs font-bold text-white bg-amber-400 px-1.5 py-0.5 rounded">SO · {new Date(e.date + 'T12:00:00').getDate()}</span>}
                      </div>
                      <p className="text-xs text-gray-400">
                        {e.categories?.name || 'Uncategorised'} · {new Date(e.date).toLocaleDateString('en-GB')}
                        {e.source === 'import' && <span className="ml-1 text-gray-300">(imported)</span>}
                      </p>
                      {e.notes && <p className="text-xs text-indigo-400 italic mt-0.5">{e.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={ev => ev.stopPropagation()}>
                    <span className="text-sm font-semibold text-gray-800">{fmt(e.amount)}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button onClick={() => setEditItem(e)} className="text-xs text-indigo-600 hover:underline">Edit</button>
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
