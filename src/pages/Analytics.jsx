import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
}

// --- Pay-period helpers (mirrors Dashboard.jsx) ---
function getActualPayday(year, month) {
  const d = new Date(year, month - 1, 28)
  const dow = d.getDay()
  if (dow === 6) d.setDate(27) // Saturday → Friday
  if (dow === 0) d.setDate(26) // Sunday → Friday
  return d
}

function dateStr(d) {
  return d.toISOString().split('T')[0]
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// 12 pay periods for a given year (Jan payday → Dec payday)
function getYearPeriods(year) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const start = getActualPayday(year, m)
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? year + 1 : year
    const end = getActualPayday(nextY, nextM) // exclusive
    return { m, start, end, label: MONTH_ABBR[i] }
  })
}

// Last N pay periods ending on or before today
function getRecentPeriods(n) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const y = today.getFullYear(), mo = today.getMonth() + 1
  const thisPayday = getActualPayday(y, mo)
  // current period start
  let cur = today >= thisPayday ? { y, m: mo } : { y: mo === 1 ? y - 1 : y, m: mo === 1 ? 12 : mo - 1 }
  const periods = []
  for (let i = 0; i < n; i++) {
    const start = getActualPayday(cur.y, cur.m)
    const nextM = cur.m === 12 ? 1 : cur.m + 1
    const nextY = cur.m === 12 ? cur.y + 1 : cur.y
    const end = getActualPayday(nextY, nextM)
    periods.unshift({ start, end, label: `${fmtDate(start)}` })
    cur = { y: cur.m === 1 ? cur.y - 1 : cur.y, m: cur.m === 1 ? 12 : cur.m - 1 }
  }
  return periods
}

const BAR_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow space-y-1">
      <p className="font-semibold text-gray-700">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [annualData, setAnnualData] = useState([])
  const [merchants, setMerchants] = useState([])
  const [momData, setMomData] = useState([])
  const [momLabels, setMomLabels] = useState([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [bestMonth, setBestMonth] = useState(null)
  const [worstMonth, setWorstMonth] = useState(null)

  useEffect(() => { fetchAll() }, [year])

  async function fetchAll() {
    setLoading(true)
    const periods = getYearPeriods(year)
    const fetchStart = dateStr(periods[0].start)
    // fetch up to the day before the 13th period starts (end of Dec period)
    const fetchEnd = dateStr(new Date(periods[11].end.getTime() - 86400000))

    const [expensesRes, incomeRes] = await Promise.all([
      supabase.from('expenses').select('date, amount, description, categories(name, color)')
        .gte('date', fetchStart).lte('date', fetchEnd),
      supabase.from('income_entries').select('date, amount')
        .gte('date', fetchStart).lte('date', fetchEnd),
    ])

    const expenses = expensesRes.data || []
    const incomeEntries = incomeRes.data || []

    // Assign a transaction to its pay period index (0-11)
    function periodIdx(dateString) {
      const d = new Date(dateString + 'T12:00:00')
      return periods.findIndex(p => d >= p.start && d < p.end)
    }

    const monthlyIncome = Array(12).fill(0)
    const monthlySpent = Array(12).fill(0)

    incomeEntries.forEach(e => {
      const idx = periodIdx(e.date)
      if (idx !== -1) monthlyIncome[idx] += Number(e.amount)
    })
    expenses.forEach(e => {
      const idx = periodIdx(e.date)
      if (idx !== -1) monthlySpent[idx] += Number(e.amount)
    })

    const annual = periods.map((p, i) => ({
      month: p.label,
      income: Math.round(monthlyIncome[i] * 100) / 100,
      spent: Math.round(monthlySpent[i] * 100) / 100,
      saved: Math.round((monthlyIncome[i] - monthlySpent[i]) * 100) / 100,
      savingsRate: monthlyIncome[i] > 0
        ? Math.round(((monthlyIncome[i] - monthlySpent[i]) / monthlyIncome[i]) * 100)
        : 0,
    }))
    setAnnualData(annual)

    const ytdIncome = monthlyIncome.reduce((s, v) => s + v, 0)
    const ytdSpent = monthlySpent.reduce((s, v) => s + v, 0)
    setTotalIncome(ytdIncome)
    setTotalSpent(ytdSpent)

    const monthsWithIncome = annual.filter(m => m.income > 0)
    if (monthsWithIncome.length) {
      setBestMonth(monthsWithIncome.reduce((a, b) => a.saved > b.saved ? a : b))
      setWorstMonth(monthsWithIncome.reduce((a, b) => a.saved < b.saved ? a : b))
    } else {
      setBestMonth(null)
      setWorstMonth(null)
    }

    // --- Top merchants ---
    const merchantMap = {}
    expenses.forEach(e => {
      const key = (e.description || 'Unknown').trim()
      if (!merchantMap[key]) merchantMap[key] = { name: key, total: 0, count: 0 }
      merchantMap[key].total += Number(e.amount)
      merchantMap[key].count++
    })
    setMerchants(Object.values(merchantMap).sort((a, b) => b.total - a.total).slice(0, 15))

    // --- Period-over-period (last 3 pay periods) ---
    const last3 = getRecentPeriods(3)
    setMomLabels(last3.map(p => p.label))

    // fetch expenses for the range covering last 3 periods
    const momStart = dateStr(last3[0].start)
    const momEnd = dateStr(new Date(last3[2].end.getTime() - 86400000))
    const { data: momExpenses } = await supabase
      .from('expenses').select('date, amount, categories(name, color)')
      .gte('date', momStart).lte('date', momEnd)

    const catMap = {}
    ;(momExpenses || []).forEach(e => {
      const d = new Date(e.date + 'T12:00:00')
      const pIdx = last3.findIndex(p => d >= p.start && d < p.end)
      if (pIdx === -1) return
      const catName = e.categories?.name || 'Uncategorised'
      const catColor = e.categories?.color || '#94a3b8'
      if (!catMap[catName]) catMap[catName] = { name: catName, color: catColor, totals: [0, 0, 0] }
      catMap[catName].totals[pIdx] += Number(e.amount)
    })
    const momRows = Object.values(catMap)
      .map(c => ({ ...c, grandTotal: c.totals.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.grandTotal - a.grandTotal)
    setMomData(momRows)

    setLoading(false)
  }

  const avgSavingsRate = annualData.filter(m => m.income > 0)
    .reduce((s, m, _, arr) => s + m.savingsRate / arr.length, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
          <p className="text-gray-500 text-sm mt-0.5">Trends, insights and spending patterns</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading...</div> : (
        <div className="space-y-5">

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Income', value: fmt(totalIncome), color: 'text-green-600' },
              { label: 'Total Spent', value: fmt(totalSpent), color: 'text-red-500' },
              { label: 'Net Saved', value: fmt(totalIncome - totalSpent), color: totalIncome - totalSpent >= 0 ? 'text-indigo-600' : 'text-red-500' },
              { label: 'Avg Savings Rate', value: `${Math.round(avgSavingsRate)}%`, color: avgSavingsRate >= 20 ? 'text-green-600' : avgSavingsRate >= 10 ? 'text-amber-600' : 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Annual bar chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Income vs Spending — {year}</h3>
            <p className="text-xs text-gray-400 mb-4">Per pay period (payday to payday)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={annualData} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `£${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <Tooltip content={<BAR_TOOLTIP />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3,3,0,0]} />
                <Bar dataKey="spent" name="Spent" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Savings rate + best/worst */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Savings Rate by Period</h3>
              <p className="text-xs text-gray-400 mb-4">% of income saved (negative = overspent)</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={annualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => `${v}%`} labelStyle={{ fontWeight: 600 }} />
                  <Line type="monotone" dataKey="savingsRate" name="Savings Rate" stroke="#6366f1"
                    strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
              <h3 className="font-semibold text-gray-900">Highlights</h3>
              {bestMonth && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-green-600 mb-0.5">Best period</p>
                  <p className="text-sm font-bold text-green-800">{bestMonth.month}</p>
                  <p className="text-xs text-green-600 mt-0.5">Saved {fmt(bestMonth.saved)} ({bestMonth.savingsRate}%)</p>
                </div>
              )}
              {worstMonth && (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-red-500 mb-0.5">Hardest period</p>
                  <p className="text-sm font-bold text-red-700">{worstMonth.month}</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {worstMonth.saved >= 0 ? `Saved ${fmt(worstMonth.saved)}` : `Overspent by ${fmt(Math.abs(worstMonth.saved))}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Top merchants + period-over-period */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Top Merchants</h3>
              <p className="text-xs text-gray-400 mb-4">Where your money goes in {year}</p>
              {merchants.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">No data</p>
              ) : (
                <div className="space-y-2.5">
                  {merchants.map((m, i) => {
                    const pct = totalSpent > 0 ? (m.total / totalSpent) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-4 text-right">{i + 1}</span>
                            <span className="text-xs font-medium text-gray-800 truncate max-w-32">{m.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-gray-800">{fmt(m.total)}</span>
                            <span className="text-xs text-gray-400 ml-1">×{m.count}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 ml-6">
                          <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Period-over-period category comparison */}
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 overflow-x-auto">
              <h3 className="font-semibold text-gray-900 mb-1">Period-over-Period</h3>
              <p className="text-xs text-gray-400 mb-4">Spending per category — last 3 pay periods</p>
              {momData.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Category</th>
                      {momLabels.map(m => (
                        <th key={m} className="text-right text-xs font-medium text-gray-400 pb-2 px-2">{m}</th>
                      ))}
                      <th className="text-right text-xs font-medium text-gray-400 pb-2 pl-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momData.map((row, i) => {
                      const [m0, m1, m2] = row.totals
                      const trend = m2 > m1 ? '↑' : m2 < m1 ? '↓' : '—'
                      const trendColor = m2 > m1 ? 'text-red-500' : m2 < m1 ? 'text-green-600' : 'text-gray-400'
                      return (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                              <span className="text-xs font-medium text-gray-700">{row.name}</span>
                            </div>
                          </td>
                          {row.totals.map((t, j) => (
                            <td key={j} className="py-2 px-2 text-right text-xs text-gray-600">
                              {t > 0 ? fmt(t) : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                          <td className={`py-2 pl-2 text-right text-sm font-bold ${trendColor}`}>{trend}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
