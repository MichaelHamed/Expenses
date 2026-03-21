import { supabase } from './supabase'

/**
 * Syncs DD/SO expenses into recurring_payments.
 * Skips any whose name already exists (case-insensitive) to avoid duplicates.
 * Returns the number of new entries created.
 */
export async function syncToRecurring(ddsoExpenses, userId) {
  if (!ddsoExpenses.length) return 0

  const { data: existing } = await supabase
    .from('recurring_payments')
    .select('name')

  const existingNames = new Set(
    (existing || []).map(r => r.name.trim().toLowerCase())
  )

  const toInsert = ddsoExpenses
    .filter(e => !existingNames.has((e.description || '').trim().toLowerCase()))
    .map(e => ({
      user_id: userId,
      name: e.description,
      amount: e.amount,
      day_of_month: new Date(e.date + 'T12:00:00').getDate(),
      type: e.payment_type,
      category_id: e.category_id || null,
      is_active: true,
    }))

  if (toInsert.length) {
    await supabase.from('recurring_payments').insert(toInsert)
  }

  return toInsert.length
}
