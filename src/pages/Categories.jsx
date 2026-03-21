import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
]

const DEFAULT_CATEGORIES = [
  { name: 'Food & Drink', color: '#22c55e' },
  { name: 'Transport', color: '#3b82f6' },
  { name: 'Bills & Utilities', color: '#f97316' },
  { name: 'Shopping', color: '#ec4899' },
  { name: 'Entertainment', color: '#8b5cf6' },
  { name: 'Health', color: '#14b8a6' },
  { name: 'Eating Out', color: '#eab308' },
  { name: 'Subscriptions', color: '#6366f1' },
  { name: 'Savings', color: '#64748b' },
  { name: 'Other', color: '#94a3b8' },
]

function CategoryForm({ onSaved, editItem, onCancel }) {
  const [form, setForm] = useState({ name: editItem?.name || '', color: editItem?.color || '#6366f1', budget: editItem?.budget || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = { ...form, budget: form.budget ? parseFloat(form.budget) : null, user_id: user.id }

    let error
    if (editItem) {
      ({ error } = await supabase.from('categories').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('categories').insert(payload))
    }

    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
    if (!editItem) setForm({ name: '', color: '#6366f1' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
          placeholder="e.g. Food & Drink"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Budget (£) <span className="text-gray-400 font-normal">optional</span></label>
        <input type="number" step="1" min="0" value={form.budget} onChange={e => set('budget', e.target.value)}
          placeholder="e.g. 300"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Colour</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
            className="w-7 h-7 rounded-full border border-gray-300 cursor-pointer" title="Custom colour" />
        </div>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : editItem ? 'Update' : 'Add Category'}
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

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { fetchCategories() }, [])

  async function fetchCategories() {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category? Expenses using it will become uncategorised.')) return
    await supabase.from('categories').delete().eq('id', id)
    fetchCategories()
  }

  async function seedDefaults() {
    setSeeding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }))
    await supabase.from('categories').insert(toInsert)
    setSeeding(false)
    fetchCategories()
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
        <p className="text-gray-500 text-sm mt-0.5">Organise your expenses into groups</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{editItem ? 'Edit Category' : 'Add Category'}</h3>
          <CategoryForm onSaved={fetchCategories} editItem={editItem} onCancel={() => setEditItem(null)} />
        </div>

        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Your categories</h3>
            {categories.length === 0 && !loading && (
              <button onClick={seedDefaults} disabled={seeding}
                className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50">
                {seeding ? 'Adding...' : '+ Add defaults'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">🏷️</div>
              <p className="text-sm">No categories yet.</p>
              <p className="text-xs mt-1">Add your own or click <strong>+ Add defaults</strong> to get started quickly.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <div>
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                      {c.budget && <span className="text-xs text-gray-400 ml-2">Budget: £{Number(c.budget).toLocaleString()}/mo</span>}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                    <button onClick={() => setEditItem(c)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:underline">Delete</button>
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
