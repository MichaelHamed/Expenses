# 💸 Flōw

A personal finance web app built with React, Supabase, and Tailwind CSS. Tracks spending, income, subscriptions, and recurring payments — with bank statement import, budget analytics, and daily email alerts.

Live at: **https://mango-bay-041656c03.4.azurestaticapps.net**

---

## What This App Does

- **Dashboard** — Pay-period aware overview: income, spent, remaining budget, daily allowance, category breakdowns, upcoming DDs, calendar widget, and recent transactions
- **Expenses** — Add, edit, delete, search, filter, and export transactions; merchant logos on every row; subscription badges flag known recurring payments
- **Income** — Record salary and other income entries
- **Import** — Upload Halifax CSV or PDF bank statements; auto-categorises, detects duplicates, tags DDs/SOs
- **Direct Debits** — Manage recurring Direct Debits and Standing Orders with weekend payment rules
- **Subscriptions** — Track annual and monthly subscriptions with a 12-month spending timeline, upcoming renewal alerts, and one-click Renew
- **Analytics** — Pay-period income vs spending charts, savings rate, top merchants, period-over-period comparison
- **Categories** — Organise spending into groups with monthly budget limits
- **Email alerts** — Daily email at 8am listing subscriptions and DDs due in the next 7 days
- **Dark mode** — Toggle between light and dark themes, preference saved in browser

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **React 19** | UI framework |
| **Vite** | Dev server and build tool |
| **Tailwind CSS v4** | Utility-first styling |
| **Supabase** | PostgreSQL database + Auth + Edge Functions |
| **React Router v7** | Client-side routing |
| **PapaParse** | Halifax CSV parsing |
| **pdfjs-dist** | Halifax PDF parsing |
| **Recharts** | Dashboard and analytics charts |
| **xlsx (SheetJS)** | Excel export (loaded on demand) |
| **Resend** | Transactional email for renewal alerts |

---

## Project Structure

```
Expenses/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      # Pay-period overview, calendar, upcoming DDs
│   │   ├── Expenses.jsx       # Transaction list with logos, badges, Excel export
│   │   ├── Income.jsx         # Income entries
│   │   ├── Import.jsx         # CSV + PDF bank statement import
│   │   ├── Recurring.jsx      # Direct Debits & Standing Orders + weekend rules
│   │   ├── Subscriptions.jsx  # Annual/monthly subs + year timeline + Renew
│   │   ├── Analytics.jsx      # Pay-period charts and comparisons
│   │   ├── Categories.jsx     # Category management with budget limits
│   │   └── Login.jsx          # Microsoft SSO + email login
│   ├── components/
│   │   └── Layout.jsx         # Sidebar (desktop) + bottom nav (mobile) + quick-add drawer
│   ├── lib/
│   │   ├── supabase.js        # Supabase client
│   │   └── syncRecurring.js   # Auto-syncs DD/SO expenses to recurring list
│   ├── App.jsx                # Routes + email allowlist guard
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles + dark mode overrides
├── supabase/
│   └── functions/
│       └── renewal-alerts/
│           └── index.ts       # Edge Function: daily email for upcoming renewals
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── icon-192.png
│   └── icon-512.png
├── supabase-schema.sql
├── supabase-recurring.sql
├── supabase-add-payment-type.sql
├── supabase-features.sql
├── staticwebapp.config.json   # Azure routing + security headers (CSP, HSTS, etc.)
├── vite.config.js
└── package.json
```

---

## How to Run Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create `.env`** in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173`

---

## Database Setup (Supabase)

Run these in the **Supabase SQL Editor** in order:

| File | Creates |
|------|---------|
| `supabase-schema.sql` | `categories`, `expenses`, `income_entries` + RLS |
| `supabase-recurring.sql` | `recurring_payments` table |
| `supabase-add-payment-type.sql` | `payment_type` column on expenses |
| `supabase-features.sql` | `budget` on categories, `notes` on expenses |

### Subscriptions table
```sql
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text default 'Other',
  billing_frequency text not null default 'monthly',
  next_renewal_date date,
  day_of_month integer,
  amount numeric(10,2) not null default 0,
  is_active boolean default true,
  auto_renew boolean default false,
  notes text,
  created_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users manage own subscriptions"
  on subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Weekend rule column (Direct Debits)
```sql
alter table recurring_payments
  add column if not exists weekend_rule text default 'none';
```

### Email alerts CRON (run after deploying the Edge Function)
```sql
-- Enable extensions first
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule daily check at 8am
select cron.schedule(
  'renewal-alerts-8am',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/renewal-alerts',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## Key Features Explained

### Dashboard
- Operates on **pay periods** (payday = 28th, adjusted for weekends)
- Shows income, spent, remaining, and daily allowance for the current period
- **Category breakdown** with budget progress bars (amber = >80%, red = over budget)
- **Income utilisation gauge** — half-circle chart showing % of income spent
- **Upcoming Direct Debits** — payments due in the next 14 days with urgency bars
- **Calendar widget** — days colour-coded by spend amount
- **Recent transactions** with category emoji icons

### Expenses
- **Merchant logos** — Google Favicon API shows brand icons next to each transaction; falls back to a coloured initial if no logo is found
- **Subscription badge** — `📦 Sub` tag on any transaction whose description matches a known subscription or DD name
- **Autocomplete** — description field suggests from last 500 expenses; fills amount, category, and type automatically
- **Export CSV** — downloads current filtered view as CSV
- **Export Excel** — two-sheet XLSX workbook: all expenses + category summary totals

### Import (Halifax Bank Statements)

**CSV:**
1. Halifax online banking → Statements → Download → CSV
2. Upload via Import page

**PDF:**
1. Download a statement PDF from Halifax
2. Upload — the app extracts text by column position (date, description, type, amounts)

**After upload:**
- **Duplicate detection** — normalises descriptions (strips punctuation) so PDF and CSV imports both match existing records
- **Auto-categorisation** — keyword matching + learned memory from past imports
- **Money In** — salary/transfers shown separately as income candidates
- **DD/SO detection** — tagged from bank's Type column and synced to Direct Debits

### Direct Debits & Standing Orders
- Add/edit/delete recurring payments with type, amount, day of month, category
- **Weekend rule** per payment: pay on exact day, Friday before, or Monday after
- Dashboard "upcoming" section respects the weekend rule when calculating days until payment
- Payments tagged as DD or SO on the Expenses page are automatically synced here

### Subscriptions
- Separate from Direct Debits — tracks Netflix, Microsoft 365, annual memberships, etc.
- **12-month timeline** bar chart — monthly outgoing for the next year across all subs + DDs
- **Upcoming renewals** — cards for non-monthly subs due in the next 90 days; colour-coded by urgency
- **↻ Renew** button — always visible on annual/fixed subscriptions; advances renewal date by 1 year instantly (supports early renewal)
- **Edit/Renew directly from upcoming cards** — no need to scroll to the list
- Billing frequencies: Monthly, Annual, Fixed term
- "Load my subscriptions" seed button — one click pre-loads known subscriptions when the table is empty

### Email Alerts (Supabase Edge Function)
A Deno function runs daily at 8am and sends an HTML email listing:
- Subscriptions with a renewal date in the next 7 days
- Direct Debits/Standing Orders due in the next 7 days

**Setup (one-time):**
```bash
# Install Supabase CLI
brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set RESEND_API_KEY=re_yourKeyHere
supabase secrets set ALERT_EMAIL=you@gmail.com

# Deploy the function
supabase functions deploy renewal-alerts
```
Then run the CRON SQL above in the Supabase SQL Editor.

> **Note:** Resend free tier only sends to your account's own email. To send to any address, verify a domain in Resend → Domains.

### Pay-Period Logic
Payday is the **28th of each month**, adjusted for weekends:
- 28th on Saturday → payday is the 27th (Friday)
- 28th on Sunday → payday is the 26th (Friday)

The current pay period runs from last payday to the day before next payday. Dashboard and Analytics both use this logic via `getActualPayday(year, month)`.

### Analytics
- **Annual chart** — income vs spending per pay period for the year
- **Savings rate** — line chart showing % of income saved each period
- **Highlights** — best and worst savings periods
- **Top merchants** — ranked spend list
- **Period-over-Period** — spending per category for the last 3 pay periods with trend arrows

### Merchant Logos
On the Expenses page, each transaction row shows a small brand icon fetched from Google's Favicon API (`google.com/s2/favicons?domain=X&sz=64`). 40+ major UK/global merchants are mapped by keyword. For unrecognised merchants, the first meaningful word of the description is tried as a `.com` domain. Falls back to a coloured initial square if no logo is found.

---

## Mobile / PWA

The app is fully responsive and installable as a PWA.

**Mobile layout:**
- Bottom navigation: 📊 Dashboard | ➕ Quick add | ☰ More
- Floating + button opens a quick-add expense drawer
- All form+list pages follow the same mobile pattern: list by default, form revealed by "+ Add" / "Edit" buttons

**Install on Android:**
1. Open Chrome → go to the live URL
2. Tap ⋮ → Add to Home Screen

**Install on iOS:**
1. Open Safari → go to the live URL
2. Tap Share → Add to Home Screen

---

## Login & Security

Sign in with **Microsoft account** (primary) or email/password (fallback).

- **Allowlist**: only `mfawehinmi@hotmail.com` can access the app — enforced in `App.jsx`
- **Row Level Security** on all Supabase tables
- **Security headers** via `staticwebapp.config.json`: CSP, HSTS, X-Frame-Options, no MIME sniffing
- **Input sanitisation**: descriptions capped at 500 chars, notes at 1,000 chars
- **No service_role key** in the browser — anon key only

---

## Deployment (Azure Static Apps)

Hosted on Azure Static Web Apps (free tier, West Europe).

```bash
rm -rf ~/.swa/deploy/ && \
npm run build && \
npx @azure/static-web-apps-cli@2.0.4 deploy dist \
  --deployment-token $(az staticwebapp secrets list \
    --name my-pocket-guard \
    --resource-group pocket-guard-rg \
    --query "properties.apiKey" -o tsv) \
  --env production
```

> **Important:** Use `@azure/static-web-apps-cli@2.0.4` — v2.0.9 crashes silently on macOS. Always clear `~/.swa/deploy/` before deploying.

Then commit and push:
```bash
git add -A && git commit -m "message" && git push origin main
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

Supabase Edge Function secrets (set via CLI):

| Secret | Description |
|--------|-------------|
| `RESEND_API_KEY` | Resend.com API key for email alerts |
| `ALERT_EMAIL` | Email address to send renewal alerts to |

---

## Halifax CSV Format

Expected header:
```
Date,Description,Type,Money In (£),Money Out (£),Balance (£)
```
Dates in `dd MMM yy` format (e.g. `02 Mar 26`).

| Code | Meaning |
|------|---------|
| `DD` | Direct Debit |
| `SO` | Standing Order |
| `BGC` | Bank Giro Credit (salary) |
| `TFR` | Transfer |
| `DEB` | Debit card |
| `FPO` | Faster Payment Out |
| `BP` | Bill Payment |

## Halifax PDF Format

Text items are extracted and grouped into rows by y-coordinate (3pt tolerance). The parser finds the header row containing `Date`, `Description`, `Type`, then maps each row's values to columns by x-position (within 60pt). Descriptions that span multiple text items are joined. Duplicate detection normalises both PDF and CSV descriptions (strips punctuation, collapses whitespace) before comparing.

---

## What's Excluded from Git

| Excluded | Reason |
|----------|--------|
| `node_modules/` | Regenerated by `npm install` |
| `dist/` | Generated by build |
| `.env` | Contains secret API keys |
| `*.csv` | Bank statement data |
| `.claude/` | AI session memory |
| `supabase/.temp/` | Supabase CLI temp files |
