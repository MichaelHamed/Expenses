import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// SVG semi-circle gauge
function GaugeChart({ spent, income }) {
  const r = 75, cx = 100, cy = 95
  const circ = 2 * Math.PI * r
  const arc = circ / 2
  const pct = income > 0 ? Math.min(spent / income, 1) : 0
  const filled = pct * arc
  const color = pct > 0.9 ? '#ef4444' : pct > 0.7 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 105" className="w-56">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="14"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
          transform={`rotate(-180 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-180 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold" style={{ fontSize: 22, fontWeight: 700, fill: '#111827' }}>
          {fmt(spent)}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 11, fill: '#9ca3af' }}>
          of {fmt(income)}
        </text>
      </svg>
      <p className="text-sm text-gray-500 -mt-1">Budget vs Spent</p>
    </div>
  )
}

// Upcoming day calculation
function daysUntil(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) {
    // Already passed — next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
    return Math.ceil((nextMonth - today) / 86400000)
  }
  return Math.ceil((thisMonth - today) / 86400000)
}

function nextDueDate(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) {
    return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
  }
  return thisMonth
}

const CUSTOM_TOOLTIP = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-500">{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [income, setIncome] = useState(0)
  const [spent, setSpent] = useState(0)
  const [categoryData, setCategoryData] = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email || ''))
  }, [])

  useEffect(() => { fetchAll() }, [year, month])

  async function fetchAll() {
    setLoading(true)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]

    // Salary is paid on the 28th of the PREVIOUS month for the current month,
    // so look back to the 25th of the previous month to capture it.
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const incomeStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-25`

    const [incomeRes, expensesRes, recurringRes] = await Promise.all([
      supabase.from('income_entries').select('amount').gte('date', incomeStart).lte('date', end),
      supabase.from('expenses').select('amount, description, date, categories(name, color, budget)').gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('recurring_payments').select('*, categories(name, color)').eq('is_active', true).order('day_of_month'),
    ])

    const totalIncome = (incomeRes.data || []).reduce((s, r) => s + Number(r.amount), 0)
    const allExpenses = expensesRes.data || []
    const totalSpent = allExpenses.reduce((s, r) => s + Number(r.amount), 0)

    // Group by category
    const catMap = {}
    allExpenses.forEach(e => {
      const name = e.categories?.name || 'Uncategorised'
      const color = e.categories?.color || '#94a3b8'
      const budget = e.categories?.budget || null
      if (!catMap[name]) catMap[name] = { name, color, budget, value: 0 }
      catMap[name].value += Number(e.amount)
    })
    const cats = Object.values(catMap).sort((a, b) => b.value - a.value)

    // Upcoming recurring — due in next 14 days
    const upcomingItems = (recurringRes.data || [])
      .map(r => ({ ...r, days: daysUntil(r.day_of_month), due: nextDueDate(r.day_of_month) }))
      .filter(r => r.days <= 14)
      .sort((a, b) => a.days - b.days)

    setIncome(totalIncome)
    setSpent(totalSpent)
    setCategoryData(cats)
    setRecentExpenses(allExpenses.slice(0, 5))
    setUpcoming(upcomingItems)
    setLoading(false)
  }

  const remaining = income - spent
  const firstName = userEmail.split('@')[0].split('.')[0]
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayOfMonth = now.getMonth() + 1 === month && now.getFullYear() === year ? now.getDate() : daysInMonth
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100)

  return (
    <div>
      {/* Month selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-2">
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

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <>
          {/* TOP ROW */}
          <div className="grid grid-cols-3 gap-5 mb-5">

            {/* Greeting card */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-6 text-white flex flex-col justify-between">
              <div>
                <p className="text-indigo-200 text-sm">{getGreeting()},</p>
                <h3 className="text-2xl font-bold mt-0.5">{displayName}</h3>
                <p className="text-indigo-200 text-xs mt-1">
                  {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-indigo-200 mb-1">
                  <span>Month progress</span>
                  <span>{monthPct}%</span>
                </div>
                <div className="w-full bg-indigo-400/40 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${monthPct}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-200">Income</p>
                    <p className="text-sm font-bold mt-0.5">{fmt(income)}</p>
                    <p className="text-xs text-indigo-300 mt-0.5">incl. prev 28th</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-200">Spent</p>
                    <p className="text-sm font-bold mt-0.5">{fmt(spent)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-indigo-200">Left</p>
                    <p className={`text-sm font-bold mt-0.5 ${remaining < 0 ? 'text-red-300' : ''}`}>{fmt(remaining)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gauge */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center">
              <h3 className="font-semibold text-gray-900 mb-2">Budget vs Expense</h3>
              <p className="text-xs text-gray-400 mb-3">{MONTHS[month-1]} {year}</p>
              <GaugeChart spent={spent} income={income} />
              {income === 0 && (
                <Link to="/income" className="text-xs text-indigo-600 hover:underline mt-2">
                  + Add your income to see gauge
                </Link>
              )}
            </div>

            {/* Donut chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Expense Distribution</h3>
              <p className="text-xs text-gray-400 mb-3">{MONTHS[month-1]} {year}</p>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-36 text-gray-300 text-sm">No data</div>
              ) : (
                <div className="flex items-center gap-2">
                  <ResponsiveContainer width="55%" height={140}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                        dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CUSTOM_TOOLTIP />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {categoryData.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-gray-600 truncate">{c.name}</span>
                        <span className="ml-auto text-gray-800 font-medium flex-shrink-0">
                          {spent > 0 ? Math.round((c.value / spent) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM ROW */}
          <div className="grid grid-cols-3 gap-5">

            {/* Category breakdown cards */}
            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Category Breakdown</h3>
                <Link to="/expenses" className="text-xs text-indigo-600 hover:underline">View all</Link>
              </div>
              {categoryData.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">No expenses this month</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {categoryData.map((c, i) => {
                    const hasBudget = c.budget > 0
                    const budgetPct = hasBudget ? Math.min((c.value / c.budget) * 100, 100) : 0
                    const overBudget = hasBudget && c.value > c.budget
                    const nearBudget = hasBudget && !overBudget && budgetPct >= 80
                    const barColor = overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : c.color
                    return (
                      <div key={i} className={`border rounded-xl p-4 hover:bg-gray-50 transition-colors ${overBudget ? 'border-red-200 bg-red-50/30' : nearBudget ? 'border-amber-200' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="text-sm font-medium text-gray-700 truncate">{c.name}</span>
                          {overBudget && <span className="ml-auto text-xs font-bold text-red-500">Over budget!</span>}
                          {nearBudget && <span className="ml-auto text-xs font-bold text-amber-500">Near limit</span>}
                        </div>
                        <p className="text-lg font-bold text-gray-900">{fmt(c.value)}</p>
                        {hasBudget ? (
                          <>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${budgetPct}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {fmt(c.value)} of {fmt(c.budget)} budget · {Math.round(budgetPct)}%
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${spent > 0 ? Math.min((c.value / spent) * 100, 100) : 0}%`, backgroundColor: c.color }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {spent > 0 ? Math.round((c.value / spent) * 100) : 0}% of total
                            </p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right column: Upcoming + Recent */}
            <div className="col-span-1 flex flex-col gap-5">

              {/* Upcoming DDs & SOs */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Upcoming Payments</h3>
                  <Link to="/recurring" className="text-xs text-indigo-600 hover:underline">Manage</Link>
                </div>
                {upcoming.length === 0 ? (
                  <div className="text-center py-4 text-gray-300 text-xs">
                    <p>No payments due in 14 days</p>
                    <Link to="/recurring" className="text-indigo-500 hover:underline mt-1 inline-block">+ Add DD / SO</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map(r => (
                      <div key={r.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${r.type === 'DD' ? 'bg-red-400' : 'bg-amber-400'}`}>
                            {r.type}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-800 leading-tight">{r.name}</p>
                            <p className="text-xs text-gray-400">
                              {r.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              {' · '}{r.days === 0 ? 'Today' : r.days === 1 ? 'Tomorrow' : `${r.days} days`}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-800">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Recent</h3>
                  <Link to="/expenses" className="text-xs text-indigo-600 hover:underline">View all</Link>
                </div>
                {recentExpenses.length === 0 ? (
                  <div className="text-center py-4 text-gray-300 text-xs">No transactions</div>
                ) : (
                  <div className="space-y-2.5">
                    {recentExpenses.map((e, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.categories?.color || '#94a3b8' }} />
                          <div>
                            <p className="text-xs font-medium text-gray-800 leading-tight truncate max-w-28">{e.description || '—'}</p>
                            <p className="text-xs text-gray-400">{e.categories?.name || 'Uncategorised'}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-800">{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
