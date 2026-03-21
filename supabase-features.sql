-- Add budget column to categories (monthly spending target)
alter table categories add column if not exists budget numeric;

-- Add notes column to expenses (free-text annotation)
alter table expenses add column if not exists notes text;
