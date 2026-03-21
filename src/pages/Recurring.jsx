import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
}

function daysUntil(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
    return Math.ceil((nextMonth - today) / 86400000)
  }
  return Math.ceil((thisMonth - today) / 86400000)
}

function RecurringForm({ categories, onSaved, editItem, onCancel }) {
  const [form, setForm] = useState({
    name: editItem?.name || '',
    amount: editItem?.amount || '',
    day_of_month: editItem?.day_of_month || 1,
    type: editItem?.type || 'DD',
    category_id: editItem?.category_id || '',
    is_active: editItem?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      day_of_month: parseInt(form.day_of_month),
      category_id: form.category_id || null,
      user_id: user.id,
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('recurring_payments').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('recurring_payments').insert(payload))
    }
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
    if (!editItem) setForm({ name: '', amount: '', day_of_month: 1, type: 'DD', category_id: '', is_active: true })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
          placeholder="e.g. ScottishPower, Netflix"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (£)</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Day of month</label>
          <input type="number" min="1" max="31" value={form.day_of_month} onChange={e => set('day_of_month', e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="DD">Direct Debit (DD)</option>
            <option value="SO">Standing Order (SO)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— Uncategorised —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
          className="rounded accent-indigo-600" />
        <span className="text-sm text-gray-600">Active</span>
      </label>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : editItem ? 'Update' : 'Add Payment'}
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

export default function Recurring() {
  const [payments, setPayments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)

  useEffect(() => {
    fetchCategories()
    fetchPayments()
  }, [])

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }

  async function fetchPayments() {
    setLoading(true)
    const { data } = await supabase.from('recurring_payments')
      .select('*, categories(name, color)')
      .order('day_of_month')
    setPayments(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this recurring payment?')) return
    await supabase.from('recurring_payments').delete().eq('id', id)
    fetchPayments()
  }

  async function toggleActive(item) {
    await supabase.from('recurring_payments').update({ is_active: !item.is_active }).eq('id', item.id)
    fetchPayments()
  }

  const dds = payments.filter(p => p.type === 'DD')
  const sos = payments.filter(p => p.type === 'SO')
  const totalDDs = dds.filter(p => p.is_active).reduce((s, p) => s + Number(p.amount), 0)
  const totalSOs = sos.filter(p => p.is_active).reduce((s, p) => s + Number(p.amount), 0)

  function PaymentRow({ p }) {
    const days = daysUntil(p.day_of_month)
    const soon = days <= 7
    return (
      <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group ${!p.is_active ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${p.type === 'DD' ? 'bg-red-400' : 'bg-amber-400'}`}>
            {p.type}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{p.name}</p>
            <p className="text-xs text-gray-400">
              Day {p.day_of_month} each month
              {p.categories && ` · ${p.categories.name}`}
              {p.is_active && <span className={`ml-2 ${soon ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                {days === 0 ? '· Due today!' : days === 1 ? '· Due tomorrow' : soon ? `· Due in ${days} days` : ''}
              </span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">{fmt(p.amount)}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
            <button onClick={() => toggleActive(p)}
              className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active ? 'text-gray-500 border-gray-300 hover:bg-gray-100' : 'text-green-600 border-green-300 hover:bg-green-50'}`}>
              {p.is_active ? 'Pause' : 'Resume'}
            </button>
            <button onClick={() => setEditItem(p)} className="text-xs text-indigo-600 hover:underline">Edit</button>
            <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Recurring Payments</h2>
        <p className="text-gray-500 text-sm mt-0.5">Manage your direct debits and standing orders</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white bg-red-400 px-2 py-0.5 rounded">DD</span>
            <span className="text-sm font-medium text-gray-700">Direct Debits</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(totalDDs)}<span className="text-sm text-gray-400 font-normal"> /month</span></p>
          <p className="text-xs text-gray-400 mt-0.5">{dds.filter(p => p.is_active).length} active</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white bg-amber-400 px-2 py-0.5 rounded">SO</span>
            <span className="text-sm font-medium text-gray-700">Standing Orders</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(totalSOs)}<span className="text-sm text-gray-400 font-normal"> /month</span></p>
          <p className="text-xs text-gray-400 mt-0.5">{sos.filter(p => p.is_active).length} active</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{editItem ? 'Edit Payment' : 'Add Payment'}</h3>
          <RecurringForm
            key={editItem?.id || 'new'}
            categories={categories}
            onSaved={fetchPayments}
            editItem={editItem}
            onCancel={() => setEditItem(null)}
          />
        </div>

        {/* List */}
        <div className="col-span-2 space-y-5">
          {/* Direct Debits */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Direct Debits</h3>
              <span className="text-xs text-gray-400">{fmt(totalDDs)} / month</span>
            </div>
            {loading ? <div className="text-gray-400 text-sm">Loading...</div> :
              dds.length === 0 ? <p className="text-sm text-gray-400">No direct debits added yet.</p> :
              dds.map(p => <PaymentRow key={p.id} p={p} />)
            }
          </div>

          {/* Standing Orders */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Standing Orders</h3>
              <span className="text-xs text-gray-400">{fmt(totalSOs)} / month</span>
            </div>
            {loading ? <div className="text-gray-400 text-sm">Loading...</div> :
              sos.length === 0 ? <p className="text-sm text-gray-400">No standing orders added yet.</p> :
              sos.map(p => <PaymentRow key={p.id} p={p} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}
