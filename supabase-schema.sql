-- ============================================================
-- Expenses App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- CATEGORIES
create table if not exists categories (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  color       text default '#6366f1',
  created_at  timestamptz default now()
);

alter table categories enable row level security;

drop policy if exists "Users manage their own categories" on categories;
create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INCOME ENTRIES
create table if not exists income_entries (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  date        date not null,
  amount      numeric(10, 2) not null,
  source      text not null,
  notes       text,
  created_at  timestamptz default now()
);

alter table income_entries enable row level security;

drop policy if exists "Users manage their own income" on income_entries;
create policy "Users manage their own income"
  on income_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- EXPENSES
create table if not exists expenses (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  date        date not null,
  amount      numeric(10, 2) not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  source      text default 'manual',  -- 'manual' or 'import'
  created_at  timestamptz default now()
);

alter table expenses enable row level security;

drop policy if exists "Users manage their own expenses" on expenses;
create policy "Users manage their own expenses"
  on expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Helpful indexes for date-range queries
create index if not exists expenses_date_idx on expenses(user_id, date);
create index if not exists income_date_idx on income_entries(user_id, date);
