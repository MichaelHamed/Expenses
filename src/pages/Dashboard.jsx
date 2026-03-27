import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dateStr(d) {
  return d.toISOString().split('T')[0]
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// Returns the actual payday Date for a given year/month.
// Normally the 28th; if Saturday → Friday 27th; if Sunday → Friday 26th.
function getActualPayday(year, month) {
  const d = new Date(year, month - 1, 28)
  const dow = d.getDay()
  if (dow === 6) d.setDate(27) // Saturday → Friday
  if (dow === 0) d.setDate(26) // Sunday → Friday
  return d
}

function nextPeriodStart(d) {
  const m = d.getMonth() + 2 // next month, 1-indexed
  const y = m > 12 ? d.getFullYear() + 1 : d.getFullYear()
  return getActualPayday(y, m > 12 ? 1 : m)
}

function prevPeriodStart(d) {
  const m = d.getMonth() // 0-indexed = previous month 1-indexed
  const y = m === 0 ? d.getFullYear() - 1 : d.getFullYear()
  return getActualPayday(y, m === 0 ? 12 : m)
}

function getCurrentPeriodStart() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const thisPayday = getActualPayday(y, m)
  if (today >= thisPayday) return thisPayday
  const prevM = m === 1 ? 12 : m - 1
  const prevY = m === 1 ? y - 1 : y
  return getActualPayday(prevY, prevM)
}

// SVG semi-circle gauge
function GaugeChart({ spent, income }) {
  const r = 75, cx = 100, cy = 95
  const circ = 2 * Math.PI * r
  const arc = circ / 2
  const pct = income > 0 ? Math.min(spent / income, 1) : 0
  const filled = pct * arc
  const color = pct > 0.9 ? '#fca5a5' : pct > 0.7 ? '#fcd34d' : '#ffffff'
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 105" className="w-56">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="14"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
          transform={`rotate(-180 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-180 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 700, fill: '#ffffff' }}>{fmt(spent)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }}>
          of {fmt(income)} income
        </text>
      </svg>
      <p className="text-sm text-white/70 -mt-1">{Math.round(pct * 100)}% of income used</p>
    </div>
  )
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

function nextDueDate(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
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
  const currentPeriodStart = getCurrentPeriodStart()

  const [periodStart, setPeriodStart] = useState(currentPeriodStart)
  const [income, setIncome] = useState(0)
  const [spent, setSpent] = useState(0)
  const [prevSpent, setPrevSpent] = useState(0)
  const [categoryData, setCategoryData] = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      const fullName = meta.full_name || meta.name || ''
      const firstName = fullName.trim().split(' ')[0]
        || (user?.email || '').split('@')[0].split('.')[0]
      setDisplayName(firstName.charAt(0).toUpperCase() + firstName.slice(1))
    })
  }, [])

  useEffect(() => { fetchAll() }, [periodStart])

  const periodEnd = nextPeriodStart(periodStart)
  const isCurrentPeriod = periodStart.getTime() === currentPeriodStart.getTime()

  async function fetchAll() {
    setLoading(true)
    const start = dateStr(periodStart)
    const end = dateStr(new Date(periodEnd.getTime() - 86400000)) // day before periodEnd

    // Previous period for comparison
    const prevStart = dateStr(prevPeriodStart(periodStart))
    const prevEnd = dateStr(new Date(periodStart.getTime() - 86400000))

    const [incomeRes, expensesRes, recurringRes, prevRes] = await Promise.all([
      supabase.from('income_entries').select('amount').gte('date', start).lte('date', end),
      supabase.from('expenses')
        .select('amount, description, date, categories(name, color, budget)')
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('recurring_payments').select('*, categories(name, color)').eq('is_active', true).order('day_of_month'),
      supabase.from('expenses').select('amount').gte('date', prevStart).lte('date', prevEnd),
    ])

    const totalIncome = (incomeRes.data || []).reduce((s, r) => s + Number(r.amount), 0)
    const allExpenses = expensesRes.data || []
    const totalSpent = allExpenses.reduce((s, r) => s + Number(r.amount), 0)
    const totalPrevSpent = (prevRes.data || []).reduce((s, r) => s + Number(r.amount), 0)

    const catMap = {}
    allExpenses.forEach(e => {
      const name = e.categories?.name || 'Uncategorised'
      const color = e.categories?.color || '#94a3b8'
      const budget = e.categories?.budget || null
      if (!catMap[name]) catMap[name] = { name, color, budget, value: 0 }
      catMap[name].value += Number(e.amount)
    })

    const upcomingItems = (recurringRes.data || [])
      .map(r => ({ ...r, days: daysUntil(r.day_of_month), due: nextDueDate(r.day_of_month) }))
      .filter(r => r.days <= 14)
      .sort((a, b) => a.days - b.days)

    setIncome(totalIncome)
    setSpent(totalSpent)
    setPrevSpent(totalPrevSpent)
    setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value))
    setRecentExpenses(allExpenses.slice(0, 8))
    setUpcoming(upcomingItems)
    setLoading(false)
  }

  // Period progress
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const totalDays = Math.round((periodEnd - periodStart) / 86400000)
  const daysPassed = Math.min(Math.round((today - periodStart) / 86400000), totalDays)
  const daysLeft = Math.max(Math.round((periodEnd - today) / 86400000), 0)
  const periodPct = Math.round((daysPassed / totalDays) * 100)

  const remaining = income - spent
  const dailyAllowance = isCurrentPeriod && daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null

  const vsLabel = prevSpent > 0
    ? (spent > prevSpent ? `+${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs prev period`
      : `${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs prev period`)
    : null
  const vsColor = prevSpent > 0 && spent > prevSpent ? 'text-red-300' : 'text-green-300'

  const periodLabel = `${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`

  return (
    <div>
      {/* Pay period navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
          <button onClick={() => setPeriodStart(prevPeriodStart(periodStart))}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">‹</button>
          <span className="text-xs font-medium text-gray-700 px-2 whitespace-nowrap">{periodLabel}</span>
          <button
            onClick={() => { if (!isCurrentPeriod) setPeriodStart(nextPeriodStart(periodStart)) }}
            disabled={isCurrentPeriod}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
        </div>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <>
          {/* TOP ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

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
                  <span>Pay period progress</span>
                  <span>{isCurrentPeriod ? `${periodPct}% · ${daysLeft}d left` : `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`}</span>
                </div>
                <div className="w-full bg-indigo-400/40 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${isCurrentPeriod ? periodPct : 100}%` }} />
                </div>
                {/* 2×2 stats */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-xs text-indigo-200">Income</p>
                    <p className="text-sm font-bold mt-0.5">{fmt(income)}</p>
                    <p className="text-xs text-indigo-300 mt-0.5">paid {fmtDate(periodStart)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-xs text-indigo-200">Spent</p>
                    <p className="text-sm font-bold mt-0.5">{fmt(spent)}</p>
                    {vsLabel && <p className={`text-xs mt-0.5 ${vsColor}`}>{vsLabel}</p>}
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-xs text-indigo-200">Remaining</p>
                    <p className={`text-sm font-bold mt-0.5 ${remaining < 0 ? 'text-red-300' : ''}`}>{fmt(remaining)}</p>
                    {income > 0 && <p className="text-xs text-indigo-300 mt-0.5">{Math.round((1 - spent / income) * 100)}% of income</p>}
                  </div>
                  <div className={`rounded-xl p-3 ${dailyAllowance !== null && dailyAllowance < 20 ? 'bg-red-500/30' : 'bg-white/10'}`}>
                    <p className="text-xs text-indigo-200">Daily budget</p>
                    {dailyAllowance !== null ? (
                      <>
                        <p className={`text-sm font-bold mt-0.5 ${dailyAllowance < 20 ? 'text-red-300' : ''}`}>
                          {fmt(dailyAllowance)}/day
                        </p>
                        <p className="text-xs text-indigo-300 mt-0.5">{daysLeft}d until {fmtDate(periodEnd)}</p>
                      </>
                    ) : (
                      <p className="text-sm font-bold mt-0.5 text-indigo-300">—</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gauge */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-6 flex flex-col items-center justify-center">
              <h3 className="font-semibold text-white mb-1">Income Utilisation</h3>
              <p className="text-xs text-emerald-200 mb-3">{periodLabel}</p>
              <GaugeChart spent={spent} income={income} />
              {income === 0 && (
                <Link to="/income" className="text-xs text-white underline mt-2">
                  + Add your income to see gauge
                </Link>
              )}
            </div>

            {/* Donut chart */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-1">Expense Distribution</h3>
              <p className="text-xs text-violet-200 mb-3">{periodLabel}</p>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-36 text-white/40 text-sm">No data</div>
              ) : (
                <div className="flex items-center gap-2">
                  <ResponsiveContainer width="55%" height={140}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                        dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CUSTOM_TOOLTIP />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {categoryData.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-violet-100 truncate">{c.name}</span>
                        <span className="ml-auto text-white font-medium flex-shrink-0">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Category breakdown */}
            <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-sky-500 to-blue-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Category Breakdown</h3>
                <Link to="/expenses" className="text-xs text-white underline">View all</Link>
              </div>
              {categoryData.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">No expenses this period</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryData.map((c, i) => {
                    const hasBudget = c.budget > 0
                    const budgetPct = hasBudget ? Math.min((c.value / c.budget) * 100, 100) : 0
                    const overBudget = hasBudget && c.value > c.budget
                    const nearBudget = hasBudget && !overBudget && budgetPct >= 80
                    const barColor = overBudget ? '#fca5a5' : nearBudget ? '#fcd34d' : c.color
                    return (
                      <div key={i} className={`rounded-xl p-4 bg-white/10 border transition-colors ${overBudget ? 'border-red-300/50' : nearBudget ? 'border-amber-300/50' : 'border-white/10'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="text-sm font-medium text-white truncate">{c.name}</span>
                          {overBudget && <span className="ml-auto text-xs font-bold text-red-300">Over budget!</span>}
                          {nearBudget && <span className="ml-auto text-xs font-bold text-amber-300">Near limit</span>}
                        </div>
                        <p className="text-lg font-bold text-white">{fmt(c.value)}</p>
                        {hasBudget ? (
                          <>
                            <div className="w-full bg-white/20 rounded-full h-1.5 mt-2">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${budgetPct}%`, backgroundColor: barColor }} />
                            </div>
                            <p className="text-xs text-white/60 mt-1">
                              {fmt(c.value)} of {fmt(c.budget)} budget · {Math.round(budgetPct)}%
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="w-full bg-white/20 rounded-full h-1.5 mt-2">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${spent > 0 ? Math.min((c.value / spent) * 100, 100) : 0}%`, backgroundColor: c.color }} />
                            </div>
                            <p className="text-xs text-white/60 mt-1">
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

            {/* Right column */}
            <div className="col-span-1 flex flex-col gap-5">

              {/* Upcoming payments */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Upcoming Payments</h3>
                  <Link to="/recurring" className="text-xs text-white underline">Manage</Link>
                </div>
                {upcoming.length === 0 ? (
                  <div className="text-center py-5 text-white/60">
                    <p className="text-2xl mb-2">📅</p>
                    <p className="text-xs font-medium text-white">No payments due in 14 days</p>
                    <p className="text-xs text-white/50 mt-1">Import a statement to auto-detect DDs & SOs</p>
                    <Link to="/recurring" className="text-xs text-white underline mt-2 inline-block">+ Add manually</Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcoming.map(r => (
                      <div key={r.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${r.type === 'DD' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
                            {r.type}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white leading-tight">{r.name}</p>
                            <p className="text-xs text-white/60">
                              {r.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              {' · '}{r.days === 0 ? 'Today' : r.days === 1 ? 'Tomorrow' : `${r.days} days`}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-white">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent transactions */}
              <div className="bg-gradient-to-br from-rose-500 to-pink-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Recent</h3>
                  <Link to="/expenses" className="text-xs text-white underline">View all</Link>
                </div>
                {recentExpenses.length === 0 ? (
                  <div className="text-center py-4 text-white/40 text-xs">No transactions this period</div>
                ) : (
                  <div className="space-y-2">
                    {recentExpenses.map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: e.categories?.color || '#94a3b8' }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white leading-tight truncate max-w-36">
                              {e.description || '—'}
                            </p>
                            <p className="text-xs text-white/60 truncate">
                              {e.categories?.name || 'Uncategorised'} · {new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-white ml-2 flex-shrink-0">{fmt(e.amount)}</span>
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
