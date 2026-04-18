import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { syncToRecurring } from '../lib/syncRecurring'

// ─── PDF parsing (Halifax layout) ────────────────────────────────────────────

async function parsePdfFile(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const allTransactions = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const items = textContent.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))

    if (!items.length) continue

    // Group items into rows by y-coordinate (3pt tolerance)
    const rowMap = {}
    items.forEach(item => {
      const existingKey = Object.keys(rowMap).find(k => Math.abs(Number(k) - item.y) <= 3)
      const key = existingKey !== undefined ? existingKey : String(item.y)
      if (!rowMap[key]) rowMap[key] = []
      rowMap[key].push(item)
    })

    // Sort rows top→bottom (descending y in PDF coords = top of page first)
    const sortedRows = Object.entries(rowMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, rowItems]) => rowItems.sort((a, b) => a.x - b.x))

    // Find the header row containing Date / Description / Type
    let headerIdx = -1
    const colPositions = {}

    for (let i = 0; i < sortedRows.length; i++) {
      const texts = sortedRows[i].map(r => r.text.toLowerCase())
      if (texts.includes('date') && texts.includes('description') && texts.includes('type')) {
        headerIdx = i
        sortedRows[i].forEach(item => {
          const t = item.text.toLowerCase()
          if (t === 'date')                       colPositions.date        = item.x
          else if (t === 'description')            colPositions.description = item.x
          else if (t === 'type')                   colPositions.type        = item.x
          else if (t.includes('money in'))         colPositions.moneyIn     = item.x
          else if (t.includes('money out'))        colPositions.moneyOut    = item.x
          else if (t.includes('balance'))          colPositions.balance     = item.x
        })
        break
      }
    }

    if (headerIdx === -1 || colPositions.date === undefined) continue

    const colEntries = Object.entries(colPositions)
    const datePattern = /^\d{2}\s+\w{3}\s+\d{2}$/

    for (let i = headerIdx + 1; i < sortedRows.length; i++) {
      const row = sortedRows[i]
      if (!row.length || !datePattern.test(row[0].text)) continue

      const txn = { date: '', description: '', type: '', moneyIn: '', moneyOut: '', balance: '' }

      row.forEach(item => {
        let nearest = { col: null, dist: Infinity }
        colEntries.forEach(([col, cx]) => {
          const dist = Math.abs(item.x - cx)
          if (dist < nearest.dist) nearest = { col, dist }
        })
        if (nearest.col && nearest.dist < 60) {
          txn[nearest.col] = txn[nearest.col] ? txn[nearest.col] + ' ' + item.text : item.text
        }
      })

      if (txn.date) allTransactions.push(txn)
    }
  }

  return allTransactions
}

function processPdfTransactions(transactions, categories, learnedMap) {
  const MONTH_MAP = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
  const parsed = []
  const parsedIncome = []

  transactions.forEach(txn => {
    const parts = txn.date.trim().split(/\s+/)
    const m = MONTH_MAP[parts[1]?.toLowerCase().substring(0, 3)]
    if (!m || parts.length < 3) return
    const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    const parsedDate = `${yr}-${m}-${parts[0].padStart(2, '0')}`

    const moneyOut = parseFloat((txn.moneyOut || '').replace(/,/g, '')) || 0
    const moneyIn  = parseFloat((txn.moneyIn  || '').replace(/,/g, '')) || 0
    const txType   = (txn.type || '').trim().toUpperCase()
    const description = txn.description || ''
    const isRoundUp = description.toUpperCase().includes('SAVETHECHANGE')

    if (moneyOut > 0) {
      const key = description.trim().toLowerCase()
      parsed.push({
        date: parsedDate,
        description,
        amount: moneyOut,
        paymentType: txType === 'DD' ? 'DD' : txType === 'SO' ? 'SO' : null,
        include: true,
        category_id: learnedMap[key] || autoCategory(description, categories),
      })
    } else if (moneyIn > 0 && !isRoundUp) {
      const source = txType === 'TFR' || txType === 'FPI' ? 'Transfer'
                   : txType === 'CSH' ? 'Cash'
                   : txType === 'BGC' ? 'Salary'
                   : 'Other'
      parsedIncome.push({ date: parsedDate, description, amount: moneyIn, source, include: true })
    }
  })

  return { parsed, parsedIncome }
}

// Keyword → category name mapping (matched against transaction description)
const CATEGORY_KEYWORDS = {
  'Food & Drink':     ['lidl','tesco store','aldi','sainsbury','asda','morrisons','waitrose','costco','co-op','iceland','marks & spencer','m&s food','greggs'],
  'Transport':        ['tesco pay at pump','bp ','shell','esso','jet ','fuel','trainline','national rail','southern','tfl','uber','parking','halfords'],
  'Bills & Utilities':['scottishpower','british gas','edf','eon ','npower','thames water','virgin media','bt ','sky ','o2','three','ee ','vodafone','tesco mobile','giffgaff','council tax','tv licence','insurance'],
  'Subscriptions':    ['disney plus','disney+','netflix','spotify','amazon prime','apple.com','claude.ai','openai','chatgpt','youtube','now tv','paramount','adobe','microsoft','google one'],
  'Shopping':         ['amazon','argos','ebay','b&q','b & q','b&m','ikea','next ','h&m','zara','asos','paypal'],
  'Eating Out':       ['wagamama','mcdonald','burger king','kfc ','pizza','nando','pret','starbucks','costa ','caffe','pub','bar ','restaurant','tearoom','cafe','greggs','deliveroo','just eat','uber eat'],
  'Health':           ['boots','lloyds pharmacy','superdrug','gym','fitness','leisure centre','dentist','doctor','hospital','nhs'],
  'Entertainment':    ['cinema','odeon','vue ','cineworld','ticketmaster','eventbrite','national trust','museum','theatre','soundz','zettle'],
  'Other':            ['savethechange','british heart','charity','donation','school','meon'],
}

function autoCategory(description, categories) {
  if (!description) return ''
  const desc = description.toLowerCase()
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => desc.includes(k))) {
      const match = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (match) return match.id
    }
  }
  return ''
}

// UK bank CSV format detectors
function detectBank(headers) {
  const h = headers.map(x => x.toLowerCase().trim())
  if (h.some(x => x.includes('money in')) && h.some(x => x.includes('money out'))) return 'halifax'
  if (h.includes('transaction type') && h.includes('sort code')) return 'barclays_lloyds'
  if (h.includes('type') && h.includes('value') && h.includes('balance') && h.length <= 6) return 'hsbc'
  if (h.includes('counter party') && h.includes('spending category')) return 'starling'
  if (h.includes('transaction id') && h.includes('emoji')) return 'monzo'
  if (h.includes('type') && h.includes('value') && h.includes('account name')) return 'natwest'
  return 'unknown'
}

function parseRow(row, bank) {
  const keys = Object.keys(row)
  const get = (names) => {
    for (const n of names) {
      const k = keys.find(k => k.toLowerCase().trim() === n.toLowerCase())
      if (k && row[k] !== undefined) return row[k]?.trim?.() || row[k]
    }
    return ''
  }

  let date, description, amount

  if (bank === 'halifax') {
    date = get(['date'])
    description = get(['description'])
    const moneyOut = parseFloat(get(['money out (£)', 'money out'])) || 0
    amount = moneyOut > 0 ? moneyOut : null
  } else if (bank === 'barclays_lloyds') {
    date = get(['date', 'transaction date'])
    description = get(['description', 'transaction description'])
    const debit = parseFloat(get(['debit amount', 'debit'])) || 0
    const credit = parseFloat(get(['credit amount', 'credit'])) || 0
    amount = debit > 0 ? debit : -credit  // debits are outgoings
  } else if (bank === 'hsbc') {
    date = get(['date'])
    description = get(['description'])
    const val = parseFloat(get(['value'])) || 0
    amount = val < 0 ? Math.abs(val) : null  // negative = spend
  } else if (bank === 'starling') {
    date = get(['date'])
    description = get(['counter party', 'reference'])
    const val = parseFloat(get(['amount (gbp)', 'amount'])) || 0
    amount = val < 0 ? Math.abs(val) : null
  } else if (bank === 'monzo') {
    date = get(['created date', 'date'])
    description = get(['name', 'merchant name', 'description'])
    const local = parseFloat(get(['local amount', 'amount'])) || 0
    amount = local < 0 ? Math.abs(local) : null
  } else if (bank === 'natwest') {
    date = get(['date'])
    description = get(['description'])
    const val = parseFloat(get(['value'])) || 0
    amount = val < 0 ? Math.abs(val) : null
  } else {
    // Generic fallback — try common names
    date = get(['date', 'transaction date', 'created date'])
    description = get(['description', 'details', 'name', 'merchant name', 'counter party'])
    const debit = parseFloat(get(['debit', 'debit amount', 'money out'])) || 0
    const val = parseFloat(get(['amount', 'value'])) || 0
    if (debit > 0) amount = debit
    else if (val < 0) amount = Math.abs(val)
    else amount = null
  }

  // Parse UK date formats
  const MONTH_MAP = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
  let parsedDate = null
  if (date) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      // dd/mm/yyyy
      const [d, m, y] = date.split('/')
      parsedDate = `${y}-${m}-${d}`
    } else if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      // yyyy-mm-dd
      parsedDate = date.substring(0, 10)
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      // dd-mm-yyyy
      const [d, m, y] = date.split('-')
      parsedDate = `${y}-${m}-${d}`
    } else if (/^\d{2}\s+\w{3}\s+\d{2,4}$/.test(date.trim())) {
      // dd MMM yy or dd MMM yyyy  (e.g. "02 Mar 26" or "02 Mar 2026") — Halifax
      const parts = date.trim().split(/\s+/)
      const d = parts[0].padStart(2, '0')
      const m = MONTH_MAP[parts[1].toLowerCase().substring(0, 3)]
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      if (m) parsedDate = `${yr}-${m}-${d}`
    }
  }

  // Extract bank transaction type for DD/SO detection
  const txType = (get(['type']) || '').trim().toUpperCase()
  const paymentType = txType === 'DD' ? 'DD' : txType === 'SO' ? 'SO' : null

  return { date: parsedDate, description: description || '', amount, paymentType }
}

// Parse money-in (income) rows from Halifax CSV
function parseIncomeRow(row, bank) {
  const keys = Object.keys(row)
  const get = (names) => {
    for (const n of names) {
      const k = keys.find(k => k.toLowerCase().trim() === n.toLowerCase())
      if (k && row[k] !== undefined) return row[k]?.trim?.() || row[k]
    }
    return ''
  }

  if (bank !== 'halifax') return null
  const moneyIn = parseFloat(get(['money in (£)', 'money in'])) || 0
  if (moneyIn <= 0) return null

  const date = get(['date'])
  const description = get(['description'])
  const txType = (get(['type']) || '').trim().toUpperCase()
  // Skip internal round-up savings (SAVETHECHANGE)
  if (description.toUpperCase().includes('SAVETHECHANGE')) return null

  const MONTH_MAP = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
  let parsedDate = null
  if (/^\d{2}\s+\w{3}\s+\d{2,4}$/.test(date?.trim() || '')) {
    const parts = date.trim().split(/\s+/)
    const d = parts[0].padStart(2, '0')
    const m = MONTH_MAP[parts[1]?.toLowerCase().substring(0, 3)]
    const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    if (m) parsedDate = `${yr}-${m}-${d}`
  } else if (/^\d{4}-\d{2}-\d{2}/.test(date || '')) {
    parsedDate = date.substring(0, 10)
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date || '')) {
    const [d, m, y] = date.split('/')
    parsedDate = `${y}-${m}-${d}`
  }

  // Guess source label
  const source = txType === 'TFR' ? 'Transfer' : txType === 'CSH' ? 'Cash' : txType === 'FPI' ? 'Transfer' : txType === 'BGC' ? 'Salary' : 'Other'

  return { date: parsedDate, description, amount: moneyIn, source, include: true }
}

function fmt(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount || 0)
}

async function checkForDuplicates(parsed, parsedIncome) {
  const markedParsed = [...parsed]
  const markedIncome = [...parsedIncome]

  // Check expense duplicates
  if (parsed.length) {
    const dates = parsed.map(r => r.date).filter(Boolean).sort()
    const { data: existing } = await supabase.from('expenses')
      .select('date, description, amount')
      .gte('date', dates[0])
      .lte('date', dates[dates.length - 1])
    const existingSet = new Set(
      (existing || []).map(e => `${e.date}|${e.description?.trim().toLowerCase()}|${Number(e.amount).toFixed(2)}`)
    )
    markedParsed.forEach((r, i) => {
      const key = `${r.date}|${r.description?.trim().toLowerCase()}|${Number(r.amount).toFixed(2)}`
      if (existingSet.has(key)) markedParsed[i] = { ...r, duplicate: true, include: false }
    })
  }

  // Check income duplicates
  if (parsedIncome.length) {
    const dates = parsedIncome.map(r => r.date).filter(Boolean).sort()
    const { data: existing } = await supabase.from('income_entries')
      .select('date, notes, amount')
      .gte('date', dates[0])
      .lte('date', dates[dates.length - 1])
    const existingSet = new Set(
      (existing || []).map(e => `${e.date}|${e.notes?.trim().toLowerCase()}|${Number(e.amount).toFixed(2)}`)
    )
    markedIncome.forEach((r, i) => {
      const key = `${r.date}|${r.description?.trim().toLowerCase()}|${Number(r.amount).toFixed(2)}`
      if (existingSet.has(key)) markedIncome[i] = { ...r, duplicate: true, include: false }
    })
  }

  return { markedParsed, markedIncome }
}

export default function Import() {
  const [categories, setCategories] = useState([])
  const [learnedMap, setLearnedMap] = useState({}) // description (normalised) → category_id
  const [rows, setRows] = useState([])           // expense rows
  const [incomeRows, setIncomeRows] = useState([]) // income rows
  const [bank, setBank] = useState('')
  const [importing, setImporting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [recurringAdded, setRecurringAdded] = useState(0)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data || []))
    // Build learned map from all previously categorised expenses
    supabase.from('expenses')
      .select('description, category_id')
      .not('category_id', 'is', null)
      .not('description', 'is', null)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => {
          const key = e.description.trim().toLowerCase()
          if (key) map[key] = e.category_id
        })
        setLearnedMap(map)
      })
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setSaved(false)
    setError('')
    setRows([])
    setIncomeRows([])

    const isPdf = file.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      setChecking(true)
      try {
        const transactions = await parsePdfFile(file)
        if (!transactions.length) {
          setError('No transactions found in this PDF. Only Halifax PDF statements are supported.')
          setChecking(false)
          return
        }
        setBank('halifax')
        const { parsed, parsedIncome } = processPdfTransactions(transactions, categories, learnedMap)
        if (!parsed.length && !parsedIncome.length) {
          setError('Could not extract transactions. Make sure this is a Halifax PDF statement.')
          setChecking(false)
          return
        }
        const { markedParsed, markedIncome } = await checkForDuplicates(parsed, parsedIncome)
        setRows(markedParsed)
        setIncomeRows(markedIncome)
      } catch (err) {
        setError('Failed to read PDF: ' + (err.message || 'unknown error'))
      }
      setChecking(false)
      return
    }

    // CSV path
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!results.data.length) { setError('The file appears to be empty.'); return }
        const detectedBank = detectBank(results.meta.fields || [])
        setBank(detectedBank)

        const parsed = results.data
          .map(row => parseRow(row, detectedBank))
          .filter(r => r.amount !== null && r.amount > 0 && r.date)
          .map(r => {
            const key = r.description.trim().toLowerCase()
            const learned = learnedMap[key]
            const keyword = autoCategory(r.description, categories)
            return { ...r, include: true, category_id: learned || keyword }
          })

        const parsedIncome = results.data
          .map(row => parseIncomeRow(row, detectedBank))
          .filter(Boolean)

        if (!parsed.length && !parsedIncome.length) {
          setError('No rows could be parsed. Check the file is a valid UK bank export.')
          return
        }

        setChecking(true)
        const { markedParsed, markedIncome } = await checkForDuplicates(parsed, parsedIncome)
        setChecking(false)

        setRows(markedParsed)
        setIncomeRows(markedIncome)
      },
      error: () => setError('Could not read the file. Make sure it is a valid CSV or Halifax PDF.'),
    })
  }

  function toggleRow(i) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, include: !r.include } : r))
  }

  function setCategory(i, cat) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, category_id: cat } : r))
  }

  function setAllCategory(cat) {
    setRows(prev => prev.map(r => ({ ...r, category_id: cat })))
  }

  async function handleSave() {
    setImporting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = rows
      .filter(r => r.include)
      .map(r => ({
        date: r.date,
        amount: Math.abs(parseFloat(r.amount.toString().replace(/[^0-9.-]/g, ''))),
        description: (r.description || '').substring(0, 500).trim(),
        category_id: r.category_id || null,
        payment_type: r.paymentType || null,
        user_id: user.id,
        source: 'import',
      }))

    const { error } = await supabase.from('expenses').insert(toInsert)
    if (error) { setImporting(false); setError(error.message); return }

    // Sync any DD/SO expenses into recurring_payments
    const ddso = toInsert.filter(e => e.payment_type === 'DD' || e.payment_type === 'SO')
    const added = await syncToRecurring(ddso, user.id)

    setImporting(false)
    setSaved(true)
    setSavedCount(toInsert.length)
    setRecurringAdded(added)
    setRows([])
    if (fileRef.current) fileRef.current.value = ''
    // Refresh learned map so next import in this session benefits too
    supabase.from('expenses').select('description, category_id')
      .not('category_id', 'is', null).not('description', 'is', null)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(e => {
          const key = e.description.trim().toLowerCase()
          if (key) map[key] = e.category_id
        })
        setLearnedMap(map)
      })
  }

  async function handleSaveIncome() {
    setImporting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const toInsert = incomeRows
      .filter(r => r.include)
      .map(r => ({
        date: r.date,
        amount: r.amount,
        source: r.source || 'Import',
        notes: r.description,
        user_id: user.id,
      }))
    const { error } = await supabase.from('income_entries').insert(toInsert)
    setImporting(false)
    if (error) { setError(error.message); return }
    setIncomeRows([])
  }

  function toggleIncomeRow(i) {
    setIncomeRows(prev => prev.map((r, idx) => idx === i ? { ...r, include: !r.include } : r))
  }

  const includedCount = rows.filter(r => r.include).length
  const includedTotal = rows.filter(r => r.include).reduce((s, r) => s + r.amount, 0)
  const includedIncomeCount = incomeRows.filter(r => r.include).length
  const includedIncomeTotal = incomeRows.filter(r => r.include).reduce((s, r) => s + r.amount, 0)

  const BANK_LABELS = {
    halifax: 'Halifax',
    barclays_lloyds: 'Barclays / Lloyds',
    hsbc: 'HSBC',
    starling: 'Starling',
    monzo: 'Monzo',
    natwest: 'NatWest',
    unknown: 'Unknown format (generic)',
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Import Bank Statement</h2>
        <p className="text-gray-500 text-sm mt-0.5">Upload a Halifax PDF statement or a CSV exported from your online banking</p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-1">Supported formats</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">Halifax PDF ✓</span>
          <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Halifax CSV</span>
          <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Barclays</span>
          <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">HSBC</span>
          <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Lloyds · NatWest · Monzo · Starling</span>
        </div>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
          <span className="text-3xl mb-2">📂</span>
          <span className="text-sm font-medium text-gray-700">Click to choose a PDF or CSV file</span>
          <span className="text-xs text-gray-400 mt-1">Halifax PDF statements are imported directly · Other banks use CSV export</span>
          <input ref={fileRef} type="file" accept=".csv,.pdf" onChange={handleFile} className="hidden" />
        </label>
        {categories.length === 0 && (
          <p className="text-amber-700 text-sm mt-3 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            ⚠️ You have no categories yet — transactions will import as Uncategorised.
            Go to <a href="/categories" className="underline font-medium">Categories</a> and click <strong>+ Add defaults</strong> first.
          </p>
        )}
        {checking && <p className="text-indigo-600 text-sm mt-3 bg-indigo-50 px-3 py-2 rounded-lg">Checking for duplicates...</p>}
        {error && <p className="text-red-600 text-sm mt-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {saved && (
          <p className="text-green-600 text-sm mt-3 bg-green-50 px-3 py-2 rounded-lg">
            ✓ {savedCount} transactions imported.
            {recurringAdded > 0 && <span className="font-medium"> {recurringAdded} DD/SO added to Direct Debits.</span>}
          </p>
        )}
        {!checking && (rows.some(r => r.duplicate) || incomeRows.some(r => r.duplicate)) && (
          <p className="text-amber-700 text-sm mt-3 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            ⚠️ <strong>{[...rows, ...incomeRows].filter(r => r.duplicate).length} duplicate{[...rows, ...incomeRows].filter(r => r.duplicate).length > 1 ? 's' : ''} detected</strong> — these already exist in your records and have been unchecked. You can still tick them to import again if needed.
          </p>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Review transactions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Detected: {BANK_LABELS[bank] || bank} · {rows.length} rows found</p>
            </div>
            <div className="flex items-center gap-3">
              <select onChange={e => setAllCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Set all category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="text-sm font-semibold text-gray-700">
                {includedCount} rows · {fmt(includedTotal)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 text-left">
                  <th className="pb-2 pr-3 w-8"></th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Description</th>
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${!r.include ? 'opacity-40' : ''} ${r.duplicate ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-2 pr-3">
                      <input type="checkbox" checked={r.include} onChange={() => toggleRow(i)}
                        className="rounded" />
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {r.date ? new Date(r.date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="py-2 pr-3 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-gray-800 text-sm">{r.description || '—'}</span>
                        {r.duplicate && <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex-shrink-0">DUPLICATE</span>}
                        {r.paymentType === 'DD' && <span className="text-xs font-bold text-white bg-red-400 px-1.5 py-0.5 rounded flex-shrink-0">DD · {r.date ? new Date(r.date + 'T12:00:00').getDate() : '?'}</span>}
                        {r.paymentType === 'SO' && <span className="text-xs font-bold text-white bg-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">SO · {r.date ? new Date(r.date + 'T12:00:00').getDate() : '?'}</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <select value={r.category_id} onChange={e => setCategory(i, e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        <option value="">Uncategorised</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-800">{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleSave} disabled={importing || includedCount === 0}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {importing ? 'Importing...' : `Import ${includedCount} expenses`}
            </button>
          </div>
        </div>
      )}

      {/* Money In — Income rows */}
      {incomeRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-green-200 p-6 mt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Money In — Add as Income?</h3>
              <p className="text-xs text-gray-400 mt-0.5">These are incoming payments detected in your statement. Tick the ones to save as income.</p>
            </div>
            <span className="text-sm font-semibold text-green-700">
              {includedIncomeCount} rows · {fmt(includedIncomeTotal)}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 text-left">
                <th className="pb-2 pr-3 w-8"></th>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Description</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((r, i) => (
                <tr key={i} className={`border-b border-gray-50 ${!r.include ? 'opacity-40' : ''} ${r.duplicate ? 'bg-amber-50/50' : ''}`}>
                  <td className="py-2 pr-3">
                    <input type="checkbox" checked={r.include} onChange={() => toggleIncomeRow(i)} className="rounded" />
                  </td>
                  <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                    {r.date ? new Date(r.date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="py-2 pr-3 text-gray-800 truncate max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{r.description || '—'}</span>
                      {r.duplicate && <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex-shrink-0">DUPLICATE</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{r.source}</span>
                  </td>
                  <td className="py-2 text-right font-semibold text-green-700">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveIncome} disabled={importing || includedIncomeCount === 0}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {importing ? 'Saving...' : `Add ${includedIncomeCount} as income`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
