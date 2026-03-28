import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'

// ─── Helpers ───────────────────────────────────────────────────────────────
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
function getActualPayday(year, month) {
  const d = new Date(year, month - 1, 28)
  const dow = d.getDay()
  if (dow === 6) d.setDate(27)
  if (dow === 0) d.setDate(26)
  return d
}
function nextPeriodStart(d) {
  const m = d.getMonth() + 2
  const y = m > 12 ? d.getFullYear() + 1 : d.getFullYear()
  return getActualPayday(y, m > 12 ? 1 : m)
}
function prevPeriodStart(d) {
  const m = d.getMonth()
  const y = m === 0 ? d.getFullYear() - 1 : d.getFullYear()
  return getActualPayday(y, m === 0 ? 12 : m)
}
function getCurrentPeriodStart() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const y = today.getFullYear(), m = today.getMonth() + 1
  const thisPayday = getActualPayday(y, m)
  if (today >= thisPayday) return thisPayday
  return getActualPayday(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
}
function daysUntil(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) return Math.ceil((new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth) - today) / 86400000)
  return Math.ceil((thisMonth - today) / 86400000)
}
function nextDueDate(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth <= today) return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
  return thisMonth
}

// ─── Category emoji ────────────────────────────────────────────────────────
function getCategoryEmoji(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('grocer') || n.includes('supermarket') || n.includes('aldi') || n.includes('tesco') || n.includes('sainsbury') || n.includes('lidl') || n.includes('asda')) return '🛒'
  if (n.includes('food') || n.includes('eat') || n.includes('restaurant') || n.includes('takeaway') || n.includes('cafe') || n.includes('coffee') || n.includes('dining')) return '🍽️'
  if (n.includes('transport') || n.includes('fuel') || n.includes('petrol') || n.includes('car') || n.includes('bus') || n.includes('train') || n.includes('uber') || n.includes('taxi')) return '🚗'
  if (n.includes('util') || n.includes('electric') || n.includes('gas') || n.includes('water') || n.includes('energy') || n.includes('power')) return '⚡'
  if (n.includes('bill') || n.includes('phone') || n.includes('broadband') || n.includes('internet') || n.includes('mobile') || n.includes('subscript')) return '📋'
  if (n.includes('health') || n.includes('medical') || n.includes('pharmacy') || n.includes('doctor') || n.includes('dental') || n.includes('nhs')) return '💊'
  if (n.includes('fitness') || n.includes('gym') || n.includes('sport')) return '💪'
  if (n.includes('saving') || n.includes('pension') || n.includes('invest')) return '💰'
  if (n.includes('bank') || n.includes('transfer') || n.includes('payment')) return '🏦'
  if (n.includes('shop') || n.includes('cloth') || n.includes('fashion') || n.includes('amazon') || n.includes('zara') || n.includes('primark')) return '🛍️'
  if (n.includes('entertain') || n.includes('cinema') || n.includes('netflix') || n.includes('spotify') || n.includes('gaming') || n.includes('streaming')) return '🎬'
  if (n.includes('education') || n.includes('school') || n.includes('course') || n.includes('book')) return '📚'
  if (n.includes('holiday') || n.includes('travel') || n.includes('flight') || n.includes('hotel') || n.includes('airbnb')) return '✈️'
  if (n.includes('insurance')) return '🛡️'
  if (n.includes('home') || n.includes('house') || n.includes('rent') || n.includes('mortgage') || n.includes('furniture') || n.includes('garden')) return '🏠'
  if (n.includes('personal') || n.includes('beauty') || n.includes('hair') || n.includes('salon')) return '💄'
  if (n.includes('gift') || n.includes('donation') || n.includes('charity')) return '🎁'
  if (n.includes('pet') || n.includes('vet') || n.includes('dog') || n.includes('cat')) return '🐾'
  return '💳'
}

// ─── Gauge ─────────────────────────────────────────────────────────────────
function GaugeChart({ spent, income }) {
  const r = 75, cx = 100, cy = 95
  const circ = 2 * Math.PI * r
  const arc = circ / 2
  const pct = income > 0 ? Math.min(spent / income, 1) : 0
  const filled = pct * arc
  const color = pct > 0.9 ? '#ef4444' : pct > 0.7 ? '#f59e0b' : '#6366f1'
  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 200 105" className="w-full max-w-xs">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="14"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(-180 ${cx} ${cy})`}
          className="dark:stroke-slate-600" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(-180 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700 }}
          className="fill-gray-900 dark:fill-white">{fmt(spent)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 11 }}
          className="fill-gray-400 dark:fill-slate-500">of {fmt(income)} income</text>
      </svg>
      <p className="text-sm text-gray-500 dark:text-slate-400 -mt-2">{Math.round(pct * 100)}% of income used</p>
    </div>
  )
}

// ─── Calendar ──────────────────────────────────────────────────────────────
function CalendarWidget() {
  const now = new Date()
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [dayData, setDayData] = useState({})

  useEffect(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    supabase.from('expenses').select('date, amount, categories(color)')
      .gte('date', start).lte('date', end)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => {
          if (!map[e.date]) map[e.date] = { total: 0, color: e.categories?.color || '#6366f1' }
          map[e.date].total += Number(e.amount)
        })
        setDayData(map)
      })
  }, [viewDate])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const startOffset = (firstDow + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-slate-300 text-sm transition-colors">‹</button>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-slate-300 text-sm transition-colors">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 dark:text-slate-500 font-medium py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 flex-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === d
          const expense = dayData[dateKey]
          return (
            <div key={i} className={`flex flex-col items-center justify-center rounded-lg py-1 ${isToday ? 'bg-indigo-100 dark:bg-indigo-900/40' : ''}`}>
              <span className={`text-xs leading-none ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-slate-300'}`}>{d}</span>
              {expense
                ? <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: expense.color }} />
                : <div className="w-1.5 h-1.5 mt-0.5" />}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-2">Dot = spending that day</p>
    </div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-500">{fmt(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

// ─── Card shell ────────────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 ${className}`}>
      {children}
    </div>
  )
}
function CardTitle({ children }) {
  return <h3 className="font-semibold text-gray-900 dark:text-white">{children}</h3>
}
function CardSub({ children }) {
  return <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{children}</p>
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
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
      const firstName = fullName.trim().split(' ')[0] || (user?.email || '').split('@')[0].split('.')[0]
      setDisplayName(firstName.charAt(0).toUpperCase() + firstName.slice(1))
    })
  }, [])

  useEffect(() => { fetchAll() }, [periodStart])

  const periodEnd = nextPeriodStart(periodStart)
  const isCurrentPeriod = periodStart.getTime() === currentPeriodStart.getTime()

  async function fetchAll() {
    setLoading(true)
    const start = dateStr(periodStart)
    const end = dateStr(new Date(periodEnd.getTime() - 86400000))
    const prevStart = dateStr(prevPeriodStart(periodStart))
    const prevEnd = dateStr(new Date(periodStart.getTime() - 86400000))

    const [incomeRes, expensesRes, recurringRes, prevRes] = await Promise.all([
      supabase.from('income_entries').select('amount').gte('date', start).lte('date', end),
      supabase.from('expenses')
        .select('amount, description, date, categories(name, color, budget)')
        .gte('date', start).lte('date', end).order('date', { ascending: false }),
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

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const totalDays = Math.round((periodEnd - periodStart) / 86400000)
  const daysPassed = Math.min(Math.round((today - periodStart) / 86400000), totalDays)
  const daysLeft = Math.max(Math.round((periodEnd - today) / 86400000), 0)
  const periodPct = Math.round((daysPassed / totalDays) * 100)
  const remaining = income - spent
  const dailyAllowance = isCurrentPeriod && daysLeft > 0 && remaining > 0 ? remaining / daysLeft : null
  const vsLabel = prevSpent > 0
    ? (spent > prevSpent
      ? `+${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs last period`
      : `${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs last period`)
    : null
  const vsPositive = prevSpent > 0 && spent <= prevSpent
  const periodLabel = `${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-1 py-1">
          <button onClick={() => setPeriodStart(prevPeriodStart(periodStart))}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">‹</button>
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 px-2 whitespace-nowrap">{periodLabel}</span>
          <button onClick={() => { if (!isCurrentPeriod) setPeriodStart(nextPeriodStart(periodStart)) }}
            disabled={isCurrentPeriod}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
        </div>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="space-y-5">

          {/* ROW 1 ─── Hero | Gauge | Donut */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Hero — the ONE coloured card */}
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
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${isCurrentPeriod ? periodPct : 100}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {[
                    { label: 'Income', value: fmt(income), sub: `paid ${fmtDate(periodStart)}` },
                    { label: 'Spent', value: fmt(spent), sub: vsLabel, subColor: vsPositive ? 'text-green-300' : 'text-red-300' },
                    { label: 'Remaining', value: fmt(remaining), sub: income > 0 ? `${Math.round((1 - spent / income) * 100)}% of income` : null, valueColor: remaining < 0 ? 'text-red-300' : '' },
                    { label: 'Daily budget', value: dailyAllowance ? `${fmt(dailyAllowance)}/day` : '—', sub: dailyAllowance ? `${daysLeft}d until ${fmtDate(periodEnd)}` : null },
                  ].map(({ label, value, sub, subColor, valueColor }) => (
                    <div key={label} className="bg-white/10 rounded-xl p-3">
                      <p className="text-xs text-indigo-200">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 ${valueColor || ''}`}>{value}</p>
                      {sub && <p className={`text-xs mt-0.5 ${subColor || 'text-indigo-300'}`}>{sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gauge */}
            <Card className="flex flex-col items-center justify-center">
              <CardTitle>Income Utilisation</CardTitle>
              <CardSub>{periodLabel}</CardSub>
              <div className="mt-4 w-full">
                <GaugeChart spent={spent} income={income} />
              </div>
              {income === 0 && (
                <Link to="/income" className="text-xs text-indigo-600 hover:underline mt-2">+ Add income to see gauge</Link>
              )}
            </Card>

            {/* Donut */}
            <Card className="flex flex-col">
              <CardTitle>Expense Distribution</CardTitle>
              <CardSub>{periodLabel}</CardSub>
              {categoryData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-300 dark:text-slate-600 text-sm py-8">No data</div>
              ) : (
                <div className="flex flex-col items-center mt-2">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                        dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CUSTOM_TOOLTIP />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-1">
                    {categoryData.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-gray-600 dark:text-slate-400">{c.name}</span>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">
                          {spent > 0 ? Math.round((c.value / spent) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ROW 2 ─── Categories | Upcoming */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Category breakdown */}
            <Card className="col-span-1 md:col-span-2 self-start">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Category Breakdown</CardTitle>
                <Link to="/expenses" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>
              </div>
              {categoryData.length === 0 ? (
                <div className="text-center py-8 text-gray-300 dark:text-slate-600 text-sm">No expenses this period</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categoryData.map((c, i) => {
                    const hasBudget = c.budget > 0
                    const budgetPct = hasBudget ? Math.min((c.value / c.budget) * 100, 100) : 0
                    const overBudget = hasBudget && c.value > c.budget
                    const nearBudget = hasBudget && !overBudget && budgetPct >= 80
                    const barColor = overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : c.color
                    const barBg = spent > 0 ? Math.min((c.value / spent) * 100, 100) : 0
                    return (
                      <div key={i} className={`rounded-2xl p-4 border flex flex-col items-center text-center transition-colors
                        ${overBudget ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'
                          : nearBudget ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10'
                          : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40'}`}>
                        {/* Icon circle — category colour as a soft tint */}
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                          style={{ backgroundColor: c.color + '22' }}>
                          {getCategoryEmoji(c.name)}
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 truncate w-full">{c.name}</p>
                        {overBudget && <span className="text-xs font-bold text-red-500 mt-0.5">Over budget!</span>}
                        {nearBudget && <span className="text-xs font-bold text-amber-500 mt-0.5">Near limit</span>}
                        <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{fmt(c.value)}</p>
                        {hasBudget && <p className="text-xs text-gray-400 dark:text-slate-500">of {fmt(c.budget)}</p>}
                        <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${hasBudget ? budgetPct : barBg}%`, backgroundColor: barColor }} />
                        </div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                          {hasBudget ? `${Math.round(budgetPct)}% of budget` : `${Math.round(barBg)}% of total`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Upcoming payments */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Upcoming Payments</CardTitle>
                <Link to="/recurring" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Manage</Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">📅</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">No payments due</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">in the next 14 days</p>
                  <Link to="/recurring" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-3 inline-block">+ Add manually</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(r => {
                    const urgencyPct = Math.max(Math.round(((14 - r.days) / 14) * 100), 4)
                    const barColor = r.days === 0 ? '#ef4444' : r.days <= 3 ? '#f59e0b' : '#6366f1'
                    return (
                      <div key={r.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: r.type === 'DD' ? '#fef3c7' : '#ede9fe' }}>
                              {r.type === 'DD' ? '🏦' : '🔄'}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 leading-tight truncate max-w-32">{r.name}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {r.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' · '}{r.days === 0 ? 'Today!' : r.days === 1 ? 'Tomorrow' : `${r.days} days`}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(r.amount)}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${urgencyPct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ROW 3 ─── Calendar | Recent */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Calendar */}
            <Card>
              <CardTitle>Calendar</CardTitle>
              <div className="mt-3">
                <CalendarWidget />
              </div>
            </Card>

            {/* Recent */}
            <Card className="col-span-1 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <CardTitle>Recent Transactions</CardTitle>
                <Link to="/expenses" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>
              </div>
              {recentExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-300 dark:text-slate-600 text-xs">No transactions this period</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700">
                  {recentExpenses.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
                          style={{ backgroundColor: (e.categories?.color || '#94a3b8') + '22' }}>
                          {getCategoryEmoji(e.categories?.name || '')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-tight truncate max-w-48">
                            {e.description || '—'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                            {e.categories?.name || 'Uncategorised'} · {new Date(e.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white ml-3 flex-shrink-0">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

        </div>
      )}
    </div>
  )
}
