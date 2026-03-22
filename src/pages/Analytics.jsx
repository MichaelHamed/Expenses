import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)
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
  const [annualData, setAnnualData] = useState([])   // per month: { month, income, spent, saved }
  const [merchants, setMerchants] = useState([])      // [{ name, total, count }]
  const [momData, setMomData] = useState([])          // month-over-month category table
  const [momMonths, setMomMonths] = useState([])      // labels for last 3 months
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [bestMonth, setBestMonth] = useState(null)
  const [worstMonth, setWorstMonth] = useState(null)

  useEffect(() => { fetchAll() }, [year])

  async function fetchAll() {
    setLoading(true)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    // Salary paid on 28th of prev month counts as month income — use same rule as Dashboard:
    // income from 25 Dec prev year to 31 Dec this year
    const incomeStart = `${year - 1}-12-25`

    const [expensesRes, incomeRes] = await Promise.all([
      supabase.from('expenses').select('date, amount, description, categories(name, color)').gte('date', yearStart).lte('date', yearEnd),
      supabase.from('income_entries').select('date, amount').gte('date', incomeStart).lte('date', yearEnd),
    ])

    const expenses = expensesRes.data || []
    const incomeEntries = incomeRes.data || []

    // --- Annual monthly data ---
    const monthlyIncome = Array(12).fill(0)
    const monthlySpent = Array(12).fill(0)

    // Assign income to month (entries from 25th of prev month → assigned to next month)
    incomeEntries.forEach(e => {
      const d = new Date(e.date + 'T12:00:00')
      let m = d.getMonth() // 0-indexed
      const day = d.getDate()
      const entryYear = d.getFullYear()
      // If from prev year (Dec 25-31) → assign to Jan (month 0)
      if (entryYear < year) {
        m = 0
      } else if (day >= 25) {
        // 25th+ of current month → assign to next month
        m = m + 1
        if (m > 11) return // overflow into next year, skip
      }
      if (m >= 0 && m <= 11) monthlyIncome[m] += Number(e.amount)
    })

    expenses.forEach(e => {
      const m = new Date(e.date + 'T12:00:00').getMonth()
      monthlySpent[m] += Number(e.amount)
    })

    const annual = MONTH_ABBR.map((label, i) => ({
      month: label,
      income: Math.round(monthlyIncome[i] * 100) / 100,
      spent: Math.round(monthlySpent[i] * 100) / 100,
      saved: Math.round((monthlyIncome[i] - monthlySpent[i]) * 100) / 100,
      savingsRate: monthlyIncome[i] > 0 ? Math.round(((monthlyIncome[i] - monthlySpent[i]) / monthlyIncome[i]) * 100) : 0,
    }))
    setAnnualData(annual)

    const ytdIncome = monthlyIncome.reduce((s, v) => s + v, 0)
    const ytdSpent = monthlySpent.reduce((s, v) => s + v, 0)
    setTotalIncome(ytdIncome)
    setTotalSpent(ytdSpent)

    // Best/worst savings month (only months with income)
    const monthsWithIncome = annual.filter(m => m.income > 0)
    if (monthsWithIncome.length) {
      setBestMonth(monthsWithIncome.reduce((a, b) => a.saved > b.saved ? a : b))
      setWorstMonth(monthsWithIncome.reduce((a, b) => a.saved < b.saved ? a : b))
    }

    // --- Top merchants ---
    const merchantMap = {}
    expenses.forEach(e => {
      const key = (e.description || 'Unknown').trim()
      if (!merchantMap[key]) merchantMap[key] = { name: key, total: 0, count: 0 }
      merchantMap[key].total += Number(e.amount)
      merchantMap[key].count++
    })
    const sorted = Object.values(merchantMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
    setMerchants(sorted)

    // --- Month-over-month (last 3 months with data) ---
    const currentMonth = now.getMonth() // 0-indexed
    const last3 = []
    for (let i = 2; i >= 0; i--) {
      let m = currentMonth - i
      let y = year
      if (m < 0) { m += 12; y-- }
      last3.push({ m, y, label: `${MONTH_ABBR[m]} ${y}` })
    }
    setMomMonths(last3.map(x => x.label))

    // Build category→month map
    const catMap = {}
    expenses.forEach(e => {
      const d = new Date(e.date + 'T12:00:00')
      const eMonth = d.getMonth()
      const eYear = d.getFullYear()
      const monthIdx = last3.findIndex(x => x.m === eMonth && x.y === eYear)
      if (monthIdx === -1) return
      const catName = e.categories?.name || 'Uncategorised'
      const catColor = e.categories?.color || '#94a3b8'
      if (!catMap[catName]) catMap[catName] = { name: catName, color: catColor, totals: [0, 0, 0] }
      catMap[catName].totals[monthIdx] += Number(e.amount)
    })
    const momRows = Object.values(catMap)
      .map(c => ({ ...c, grandTotal: c.totals.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.grandTotal - a.grandTotal)
    setMomData(momRows)

    setLoading(false)
  }

  const avgSavingsRate = annualData.filter(m => m.income > 0).reduce((s, m, _, arr) => s + m.savingsRate / arr.length, 0)

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
            <p className="text-xs text-gray-400 mb-4">Monthly overview for the full year</p>
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
              <h3 className="font-semibold text-gray-900 mb-1">Savings Rate by Month</h3>
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

            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 md:flex-col flex-row flex-wrap">
              <h3 className="font-semibold text-gray-900 w-full">Highlights</h3>
              {bestMonth && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-green-600 mb-0.5">Best month</p>
                  <p className="text-sm font-bold text-green-800">{bestMonth.month}</p>
                  <p className="text-xs text-green-600 mt-0.5">Saved {fmt(bestMonth.saved)} ({bestMonth.savingsRate}%)</p>
                </div>
              )}
              {worstMonth && (
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-red-500 mb-0.5">Hardest month</p>
                  <p className="text-sm font-bold text-red-700">{worstMonth.month}</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {worstMonth.saved >= 0 ? `Saved ${fmt(worstMonth.saved)}` : `Overspent by ${fmt(Math.abs(worstMonth.saved))}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Top merchants + month-over-month */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Top merchants */}
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

            {/* Month-over-month category comparison */}
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 overflow-x-auto">
              <h3 className="font-semibold text-gray-900 mb-1">Month-over-Month</h3>
              <p className="text-xs text-gray-400 mb-4">Spending per category — last 3 months</p>
              {momData.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-4">Category</th>
                      {momMonths.map(m => (
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
