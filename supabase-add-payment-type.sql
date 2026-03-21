-- Add payment_type column to expenses
-- Run in: Supabase Dashboard → SQL Editor → New Query
alter table expenses add column if not exists payment_type text;
