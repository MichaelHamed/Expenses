import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ResponsiveGridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { supabase } from '../lib/supabase'
const STORAGE_KEY = 'pg-dashboard-layout'

// ─── Pay-period helpers ────────────────────────────────────────────────────
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

// ─── Drag handle ───────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <div className="drag-handle cursor-grab active:cursor-grabbing flex justify-center pb-2 opacity-30 hover:opacity-60 transition-opacity select-none" title="Drag to rearrange">
      <svg width="24" height="8" viewBox="0 0 24 8" fill="white">
        <circle cx="3"  cy="2" r="1.5"/><circle cx="9"  cy="2" r="1.5"/>
        <circle cx="15" cy="2" r="1.5"/><circle cx="21" cy="2" r="1.5"/>
        <circle cx="3"  cy="6" r="1.5"/><circle cx="9"  cy="6" r="1.5"/>
        <circle cx="15" cy="6" r="1.5"/><circle cx="21" cy="6" r="1.5"/>
      </svg>
    </div>
  )
}

// ─── Gauge chart ───────────────────────────────────────────────────────────
function GaugeChart({ spent, income }) {
  const r = 75, cx = 100, cy = 95
  const circ = 2 * Math.PI * r
  const arc = circ / 2
  const pct = income > 0 ? Math.min(spent / income, 1) : 0
  const filled = pct * arc
  const color = pct > 0.9 ? '#fca5a5' : pct > 0.7 ? '#fcd34d' : '#ffffff'
  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 200 105" className="w-full max-w-xs">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="14"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(-180 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform={`rotate(-180 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 24, fontWeight: 700, fill: '#ffffff' }}>{fmt(spent)}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 12, fill: 'rgba(255,255,255,0.6)' }}>
          of {fmt(income)} income
        </text>
      </svg>
      <p className="text-sm text-white/70 -mt-2">{Math.round(pct * 100)}% of income used</p>
    </div>
  )
}

// ─── Calendar widget ───────────────────────────────────────────────────────
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
  const startOffset = (firstDow + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="flex flex-col h-full">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm transition-colors">‹</button>
        <span className="text-sm font-semibold text-white">
          {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm transition-colors">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-white/50 font-medium py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 content-start gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === d
          const expense = dayData[dateKey]
          return (
            <div key={i} className={`flex flex-col items-center justify-center rounded-lg py-1 ${isToday ? 'bg-white/30' : expense ? 'bg-white/10' : ''}`}>
              <span className={`text-xs leading-none ${isToday ? 'font-bold text-white' : 'text-white/70'}`}>{d}</span>
              {expense
                ? <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: expense.color }} />
                : <div className="w-1.5 h-1.5 mt-0.5" />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <p className="text-xs text-white/40 text-center mt-2">Dots = days with spending</p>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────
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

// ─── Default grid layout ───────────────────────────────────────────────────
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'greeting', x: 0, y: 0,  w: 4, h: 7 },
    { i: 'gauge',    x: 4, y: 0,  w: 4, h: 7 },
    { i: 'donut',    x: 8, y: 0,  w: 4, h: 7 },
    { i: 'category', x: 0, y: 7,  w: 8, h: 5 },
    { i: 'upcoming', x: 8, y: 7,  w: 4, h: 8 },
    { i: 'calendar', x: 0, y: 12, w: 4, h: 7 },
    { i: 'recent',   x: 4, y: 12, w: 8, h: 7 },
  ],
  md: [
    { i: 'greeting', x: 0, y: 0,  w: 5, h: 7 },
    { i: 'gauge',    x: 5, y: 0,  w: 5, h: 7 },
    { i: 'donut',    x: 0, y: 7,  w: 5, h: 7 },
    { i: 'category', x: 5, y: 7,  w: 5, h: 5 },
    { i: 'upcoming', x: 0, y: 14, w: 5, h: 8 },
    { i: 'calendar', x: 5, y: 14, w: 5, h: 7 },
    { i: 'recent',   x: 0, y: 22, w: 10, h: 7 },
  ],
  sm: [
    { i: 'greeting', x: 0, y: 0,  w: 6, h: 7 },
    { i: 'gauge',    x: 0, y: 7,  w: 6, h: 7 },
    { i: 'donut',    x: 0, y: 14, w: 6, h: 7 },
    { i: 'category', x: 0, y: 21, w: 6, h: 5 },
    { i: 'upcoming', x: 0, y: 26, w: 6, h: 8 },
    { i: 'calendar', x: 0, y: 34, w: 6, h: 7 },
    { i: 'recent',   x: 0, y: 41, w: 6, h: 7 },
  ],
}

// ─── Dashboard ────────────────────────────────────────────────────────────
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
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUTS
    } catch { return DEFAULT_LAYOUTS }
  })

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
    ? (spent > prevSpent ? `+${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs prev period`
      : `${Math.round(((spent - prevSpent) / prevSpent) * 100)}% vs prev period`)
    : null
  const vsColor = prevSpent > 0 && spent > prevSpent ? 'text-red-300' : 'text-green-300'
  const periodLabel = `${fmtDate(periodStart)} → ${fmtDate(periodEnd)}`

  function onLayoutChange(_, allLayouts) {
    setLayouts(allLayouts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts))
  }

  function resetLayout() {
    setLayouts(DEFAULT_LAYOUTS)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <div className="flex items-center gap-2">
          <button onClick={resetLayout}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
            title="Reset widget layout">
            ↺ Reset layout
          </button>
          <div className="flex items-center gap-1 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl px-1 py-1">
            <button onClick={() => setPeriodStart(prevPeriodStart(periodStart))}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">‹</button>
            <span className="text-xs font-medium text-gray-700 dark:text-white px-2 whitespace-nowrap">{periodLabel}</span>
            <button onClick={() => { if (!isCurrentPeriod) setPeriodStart(nextPeriodStart(periodStart)) }}
              disabled={isCurrentPeriod}
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
          </div>
        </div>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <ResponsiveGridLayout
          layouts={layouts}
          onLayoutChange={onLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 0 }}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={50}
          margin={[16, 16]}
          draggableHandle=".drag-handle"
          isResizable={false}>

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <div key="greeting">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 text-white h-full flex flex-col overflow-hidden">
              <DragHandle />
              <div>
                <p className="text-indigo-200 text-sm">{getGreeting()},</p>
                <h3 className="text-2xl font-bold mt-0.5">{displayName}</h3>
                <p className="text-indigo-200 text-xs mt-1">
                  {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <div className="mt-4 flex-1 flex flex-col justify-end">
                <div className="flex justify-between text-xs text-indigo-200 mb-1">
                  <span>Pay period progress</span>
                  <span>{isCurrentPeriod ? `${periodPct}% · ${daysLeft}d left` : `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`}</span>
                </div>
                <div className="w-full bg-indigo-400/40 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${isCurrentPeriod ? periodPct : 100}%` }} />
                </div>
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
                        <p className={`text-sm font-bold mt-0.5 ${dailyAllowance < 20 ? 'text-red-300' : ''}`}>{fmt(dailyAllowance)}/day</p>
                        <p className="text-xs text-indigo-300 mt-0.5">{daysLeft}d until {fmtDate(periodEnd)}</p>
                      </>
                    ) : <p className="text-sm font-bold mt-0.5 text-indigo-300">—</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Gauge ────────────────────────────────────────────────── */}
          <div key="gauge">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 h-full flex flex-col items-center justify-center overflow-hidden">
              <DragHandle />
              <h3 className="font-semibold text-white mb-1">Income Utilisation</h3>
              <p className="text-xs text-emerald-200 mb-3">{periodLabel}</p>
              <GaugeChart spent={spent} income={income} />
              {income === 0 && (
                <Link to="/income" className="text-xs text-white underline mt-2">+ Add income to see gauge</Link>
              )}
            </div>
          </div>

          {/* ── Donut ────────────────────────────────────────────────── */}
          <div key="donut">
            <div className="bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
              <DragHandle />
              <h3 className="font-semibold text-white mb-1">Expense Distribution</h3>
              <p className="text-xs text-violet-200 mb-2">{periodLabel}</p>
              {categoryData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/40 text-sm">No data</div>
              ) : (
                <div className="flex flex-col items-center flex-1">
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={58} outerRadius={88}
                        dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CUSTOM_TOOLTIP />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 -mt-2">
                    {categoryData.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-violet-100">{c.name}</span>
                        <span className="text-white font-medium">{spent > 0 ? Math.round((c.value / spent) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Category breakdown ───────────────────────────────────── */}
          <div key="category">
            <div className="bg-gradient-to-br from-fuchsia-600 to-purple-800 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
              <DragHandle />
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Category Breakdown</h3>
                <Link to="/expenses" className="text-xs text-white underline">View all</Link>
              </div>
              {categoryData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/40 text-sm">No expenses this period</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
                  {categoryData.map((c, i) => {
                    const hasBudget = c.budget > 0
                    const budgetPct = hasBudget ? Math.min((c.value / c.budget) * 100, 100) : 0
                    const overBudget = hasBudget && c.value > c.budget
                    const nearBudget = hasBudget && !overBudget && budgetPct >= 80
                    const barColor = overBudget ? '#fca5a5' : nearBudget ? '#fcd34d' : '#ffffff'
                    const barBg = spent > 0 ? Math.min((c.value / spent) * 100, 100) : 0
                    return (
                      <div key={i} className={`rounded-2xl p-3 bg-white/10 border flex flex-col items-center text-center ${overBudget ? 'border-red-300/60' : nearBudget ? 'border-amber-300/60' : 'border-white/10'}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl mb-1.5">
                          {getCategoryEmoji(c.name)}
                        </div>
                        <p className="text-xs font-semibold text-white/80 truncate w-full">{c.name}</p>
                        {overBudget && <span className="text-xs font-bold text-red-300">Over!</span>}
                        {nearBudget && <span className="text-xs font-bold text-amber-300">Near</span>}
                        <p className="text-sm font-bold text-white mt-1">{fmt(c.value)}</p>
                        {hasBudget && <p className="text-xs text-white/50">of {fmt(c.budget)}</p>}
                        <div className="w-full bg-white/20 rounded-full h-1.5 mt-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${hasBudget ? budgetPct : barBg}%`, backgroundColor: barColor }} />
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          {hasBudget ? `${Math.round(budgetPct)}%` : `${Math.round(barBg)}% of total`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Upcoming payments ────────────────────────────────────── */}
          <div key="upcoming">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
              <DragHandle />
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Upcoming Payments</h3>
                <Link to="/recurring" className="text-xs text-white underline">Manage</Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p className="text-2xl mb-2">📅</p>
                  <p className="text-xs font-medium text-white">No payments due in 14 days</p>
                  <Link to="/recurring" className="text-xs text-white underline mt-2">+ Add manually</Link>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {upcoming.map(r => {
                    const urgencyPct = Math.max(Math.round(((14 - r.days) / 14) * 100), 6)
                    const barColor = r.days === 0 ? '#fca5a5' : r.days <= 3 ? '#fcd34d' : '#ffffff'
                    return (
                      <div key={r.id} className="bg-white/10 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg flex-shrink-0">
                              {r.type === 'DD' ? '🏦' : '🔄'}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white leading-tight truncate max-w-28">{r.name}</p>
                              <p className="text-xs text-white/60">
                                {r.due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                {' · '}{r.days === 0 ? 'Today!' : r.days === 1 ? 'Tomorrow' : `${r.days} days`}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-white flex-shrink-0">{fmt(r.amount)}</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${urgencyPct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Calendar ─────────────────────────────────────────────── */}
          <div key="calendar">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-700 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
              <DragHandle />
              <h3 className="font-semibold text-white mb-2">Calendar</h3>
              <div className="flex-1 min-h-0">
                <CalendarWidget />
              </div>
            </div>
          </div>

          {/* ── Recent ───────────────────────────────────────────────── */}
          <div key="recent">
            <div className="bg-gradient-to-br from-rose-500 to-pink-700 rounded-2xl p-5 h-full flex flex-col overflow-hidden">
              <DragHandle />
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Recent</h3>
                <Link to="/expenses" className="text-xs text-white underline">View all</Link>
              </div>
              {recentExpenses.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-white/40 text-xs">No transactions this period</div>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {recentExpenses.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: e.categories?.color || '#94a3b8' }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white leading-tight truncate max-w-48">
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

        </ResponsiveGridLayout>
      )}
    </div>
  )
}
