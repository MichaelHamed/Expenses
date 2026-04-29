import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendKey  = Deno.env.get('RESEND_API_KEY')!
const alertEmail = Deno.env.get('ALERT_EMAIL') ?? 'mfawehinmi@hotmail.com'

const db = createClient(supabaseUrl, supabaseKey)

function fmtGBP(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n)
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

Deno.serve(async () => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7)
  const todayStr = today.toISOString().split('T')[0]
  const in7Str   = in7.toISOString().split('T')[0]

  // Upcoming subscription renewals in the next 7 days
  const { data: renewals } = await db
    .from('subscriptions')
    .select('name, amount, next_renewal_date, billing_frequency, auto_renew')
    .eq('is_active', true)
    .neq('billing_frequency', 'monthly')
    .gte('next_renewal_date', todayStr)
    .lte('next_renewal_date', in7Str)
    .order('next_renewal_date')

  // DDs/SOs due in the next 7 days (day_of_month falls within range)
  const { data: allDDs } = await db
    .from('recurring_payments')
    .select('name, amount, day_of_month, type')
    .eq('is_active', true)

  const todayDay = today.getDate()
  const in7Day   = in7.getDate()
  const crossesMonth = in7Day < todayDay

  const ddsDue = (allDDs || []).filter(r => {
    const d = r.day_of_month
    return crossesMonth ? (d >= todayDay || d <= in7Day) : (d >= todayDay && d <= in7Day)
  })

  const hasRenewals = renewals && renewals.length > 0
  const hasDDs      = ddsDue.length > 0

  if (!hasRenewals && !hasDDs) {
    return new Response(JSON.stringify({ sent: false, reason: 'Nothing due in 7 days' }), { status: 200 })
  }

  // Build email HTML
  let body = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">`
  body += `<h2 style="color:#4f46e5;margin-bottom:4px">My Pocket Guard</h2>`
  body += `<p style="color:#6b7280;margin-top:0">Upcoming payments in the next 7 days</p>`

  if (hasRenewals) {
    body += `<h3 style="color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Subscription renewals</h3>`
    body += `<table style="width:100%;border-collapse:collapse">`
    for (const s of renewals!) {
      const days = Math.ceil((new Date(s.next_renewal_date).getTime() - today.getTime()) / 86400000)
      const urgentColor = days <= 2 ? '#dc2626' : days <= 4 ? '#d97706' : '#374151'
      body += `<tr style="border-bottom:1px solid #f3f4f6">`
      body += `<td style="padding:10px 0;font-weight:600;color:#111827">${s.name}</td>`
      body += `<td style="padding:10px 0;color:${urgentColor};font-weight:600;text-align:right">${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</td>`
      body += `</tr>`
      body += `<tr style="border-bottom:1px solid #f3f4f6">`
      body += `<td style="padding:0 0 10px;color:#6b7280;font-size:13px">${fmtDate(s.next_renewal_date)}${s.auto_renew ? ' · 🔄 Auto-renews' : ''}</td>`
      body += `<td style="padding:0 0 10px;color:#374151;text-align:right;font-size:14px">${s.amount > 0 ? fmtGBP(s.amount) : '— check email'}</td>`
      body += `</tr>`
    }
    body += `</table>`
  }

  if (hasDDs) {
    body += `<h3 style="color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px">Direct Debits & Standing Orders due</h3>`
    body += `<table style="width:100%;border-collapse:collapse">`
    for (const r of ddsDue) {
      const badge = r.type === 'DD' ? '#f87171' : '#fbbf24'
      body += `<tr style="border-bottom:1px solid #f3f4f6">`
      body += `<td style="padding:10px 0"><span style="background:${badge};color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;margin-right:8px">${r.type}</span><span style="font-weight:600;color:#111827">${r.name}</span></td>`
      body += `<td style="padding:10px 0;text-align:right;color:#374151;font-weight:600">${fmtGBP(r.amount)}<br><span style="font-size:12px;color:#9ca3af;font-weight:400">Day ${r.day_of_month}</span></td>`
      body += `</tr>`
    }
    body += `</table>`
  }

  body += `<p style="margin-top:32px;color:#9ca3af;font-size:12px">Sent by My Pocket Guard · <a href="https://mango-bay-041656c03.4.azurestaticapps.net/subscriptions" style="color:#6366f1">View subscriptions →</a></p>`
  body += `</div>`

  const count = (renewals?.length ?? 0) + ddsDue.length
  const subject = `${count} payment${count > 1 ? 's' : ''} due in the next 7 days`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'My Pocket Guard <onboarding@resend.dev>', to: alertEmail, subject, html: body }),
  })

  const data = await res.json()
  return new Response(JSON.stringify({ sent: res.ok, status: res.status, data }), { status: 200 })
})
