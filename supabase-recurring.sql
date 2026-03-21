-- ============================================================
-- Recurring Payments (Direct Debits & Standing Orders)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

create table if not exists recurring_payments (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users not null,
  name          text not null,
  amount        numeric(10, 2) not null,
  day_of_month  integer not null check (day_of_month between 1 and 31),
  type          text not null check (type in ('DD', 'SO')),
  category_id   uuid references categories(id) on delete set null,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table recurring_payments enable row level security;

drop policy if exists "Users manage their own recurring payments" on recurring_payments;
create policy "Users manage their own recurring payments"
  on recurring_payments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_user_idx on recurring_payments(user_id);
