# 🛡️ My Pocket Guard

A personal monthly expense tracking web app built with React, Supabase, and Tailwind CSS. Designed for a single user to track spending, import Halifax bank statements, manage recurring payments, track subscriptions, and understand their finances at a glance.

Live at: **https://mango-bay-041656c03.4.azurestaticapps.net**

---

## What This App Does

- **Dashboard** — See income, spending, remaining budget, daily allowance, and pay-period progress at a glance
- **Expenses** — Add, edit, delete, search, filter and export transactions; subscription badges highlight known recurring payments
- **Income** — Record salary and other income entries
- **Import** — Upload a Halifax CSV or PDF bank statement and auto-import transactions (with duplicate detection)
- **Direct Debits** — Manage recurring Direct Debits and Standing Orders (monthly)
- **Subscriptions** — Track annual and monthly subscriptions with a 12-month spending timeline and upcoming renewal alerts
- **Analytics** — Pay-period income vs spending charts, savings rate, top merchants, period-over-period comparison
- **Categories** — Organise spending into groups with optional monthly budget limits
- **Dark mode** — Toggle between light and dark themes, preference saved in browser

---

## Tech Stack

| Tool | What it is | Why it's used |
|------|-----------|---------------|
| **React 19** | JavaScript UI framework | Builds the interactive pages and components |
| **Vite** | Development server & build tool | Runs the app locally and bundles it for deployment |
| **Tailwind CSS v4** | Utility-first CSS framework | Styles every element without writing separate CSS files |
| **Supabase** | Cloud database (PostgreSQL) + Auth | Stores all your data securely online with user login |
| **React Router v7** | Page routing | Handles navigation between pages without full page reloads |
| **PapaParse** | CSV parser | Reads Halifax bank statement CSV files in the browser |
| **pdfjs-dist** | PDF parser | Reads Halifax bank statement PDF files in the browser |
| **Recharts** | Chart library | Draws charts on the dashboard and analytics pages |

---

## Project Structure

```
Expenses/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      # Main overview page (pay-period aware, calendar widget)
│   │   ├── Expenses.jsx       # Add/edit/delete/search expenses (+ subscription badges)
│   │   ├── Income.jsx         # Record income entries
│   │   ├── Import.jsx         # Upload & import bank statement (CSV or PDF)
│   │   ├── Recurring.jsx      # Manage Direct Debits & Standing Orders
│   │   ├── Subscriptions.jsx  # Track annual/monthly subscriptions + year timeline
│   │   ├── Analytics.jsx      # Charts, top merchants, pay-period comparison
│   │   ├── Categories.jsx     # Manage spending categories + budgets
│   │   └── Login.jsx          # Microsoft SSO + email login screen
│   ├── components/
│   │   └── Layout.jsx         # Sidebar (desktop) + bottom nav (mobile)
│   ├── lib/
│   │   ├── supabase.js        # Supabase client (connects to your database)
│   │   └── syncRecurring.js   # Auto-adds DD/SO expenses to recurring list
│   ├── App.jsx                # Route definitions + email allowlist guard
│   ├── main.jsx               # App entry point
│   └── index.css              # Global styles + dark mode overrides
├── public/
│   ├── manifest.json          # PWA manifest (enables "Add to Home Screen")
│   ├── icon-192.png           # App icon (small)
│   └── icon-512.png           # App icon (large)
├── supabase-schema.sql        # Run once: creates main tables
├── supabase-recurring.sql     # Run once: creates recurring_payments table
├── supabase-add-payment-type.sql  # Run once: adds payment_type column
├── supabase-features.sql      # Run once: adds budget + notes columns
├── staticwebapp.config.json   # Azure Static Apps routing + security headers
├── vite.config.js             # Vite + Tailwind plugin config
├── package.json               # Project dependencies and scripts
└── .gitignore                 # Files excluded from git (CSV, .env, etc.)
```

---

## How to Run Locally

### Prerequisites
- Node.js v18 or higher (check with `node --version`)
- A Supabase account and project

### Steps

1. **Clone or open the project folder** in VS Code

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create your environment file** — create `.env` in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   > Get these from: Supabase Dashboard → Your Project → Settings → API

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   > Open your browser at `http://localhost:5173`

5. **To stop the server**, press `Ctrl + C`

---

## Database Setup (Supabase)

Run these SQL snippets **once** in the Supabase SQL Editor:

**How to run SQL in Supabase:**
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Click **SQL Editor** in the left sidebar → **New Query**
3. Paste the SQL → Click **Run**

### Core tables (run in order)

| File | What it creates |
|------|----------------|
| `supabase-schema.sql` | `categories`, `expenses`, `income_entries` tables + RLS |
| `supabase-recurring.sql` | `recurring_payments` table for Direct Debits & Standing Orders |
| `supabase-add-payment-type.sql` | Adds `payment_type` column to expenses (DD / SO / null) |
| `supabase-features.sql` | Adds `budget` to categories and `notes` to expenses |

### Subscriptions table (newer — run separately)

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

> All tables use **Row Level Security (RLS)** — each user can only ever see their own data.

---

## Key Features Explained

### Dashboard

- Operates on **pay periods** (payday = 28th, adjusted for weekends) rather than calendar months
- Shows income, spent, remaining, and daily budget for the current pay period
- **Category breakdown** with budget progress bars
- **Income utilisation gauge** — visual showing what % of income has been spent
- **Upcoming Direct Debits** — shows payments due in the next 14 days with urgency bars
- **Calendar widget** — shows days with spending, colour-coded by amount
- **Recent transactions** with category emoji icons
- Clean single-accent design (indigo only for meaning, not decoration)

### Subscriptions

A dedicated page for tracking annual and monthly subscriptions (separate from Direct Debits):

- **12-month timeline** — bar chart showing total outgoing per month for the next year, including both subscriptions and DDs. Hover a bar to see what's due that month
- **Upcoming renewals** — cards for annual subscriptions due in the next 90 days, coloured by urgency (red = within 7 days, amber = within 30 days)
- **Summary cards** — monthly equivalent cost, annual total, count of renewals due in 30 days
- **Direct Debits section** — read-only view of your DDs/SOs from the Recurring page, included in totals
- **Subscription badge on expenses** — any expense whose description matches a subscription or DD name shows a `📦 Sub` badge on the Expenses page
- Supports billing frequencies: Monthly, Annual, Fixed term
- Fields: name, category, frequency, amount, renewal date or day of month, auto-renew flag, notes
- **"Load my subscriptions"** button — one-click seed with your known subscriptions (shown when table is empty)

### Importing a Halifax Bank Statement

The Import page accepts both **CSV** and **PDF** formats:

**CSV (recommended):**
1. Log into Halifax online banking
2. Go to **Statements** → select the month → **Download** → choose **CSV**
3. In My Pocket Guard, go to **Import** → upload the CSV

**PDF:**
1. Download a statement PDF from Halifax
2. Upload via the Import page — the app extracts transaction data from the PDF layout using column-position matching

**What happens after upload:**
- **Duplicate detection** — rows already in your records are flagged with a yellow "DUPLICATE" badge and unticked automatically
- **Auto-categorisation** — descriptions matched against a keyword list and against your previously categorised transactions (learned memory)
- **Money In** — salary, deposits, and transfers in shown separately as income to add
- **DD / SO detection** — tagged automatically from the bank's Type column and synced to your Direct Debits list

### Pay-Period Logic

The app treats finances in **pay periods**, not calendar months. The payday rule:

- Payday is the **28th of each month**
- If the 28th falls on a **Saturday**, payday moves to the 27th
- If the 28th falls on a **Sunday**, payday moves to the 26th

The current pay period runs from the last payday to the day before the next payday. Both the Dashboard and Analytics use this logic consistently. The `getActualPayday(year, month)` helper in each page handles the weekend adjustment.

### Analytics

- **Annual chart** — income vs spending bar chart per pay period for the year
- **Savings rate** — line chart showing % of income saved each period
- **Highlights** — best and worst savings periods of the year
- **Top merchants** — ranked list of where your money goes
- **Period-over-Period** — spending per category for the last 3 pay periods with trend arrows and period-start dates as column headers

### Direct Debits & Standing Orders

When an expense is tagged as DD or SO (during import or when added manually), it is automatically synced to the **Direct Debits** page. This page shows:
- All recurring payments with type, amount, day of month, and category
- Summary totals for DDs and SOs separately
- Dashboard shows upcoming payments due within the next 14 days

### Expense Subscription Badge

On the Expenses page, any transaction whose description contains a word matching a known subscription or recurring payment name shows a `📦 Sub` badge. This makes it easy to verify that a subscription charged and to spot unrecognised charges.

### Budget Targets

In **Categories**, set a monthly budget limit per category (e.g. Groceries: £300). On the Dashboard:
- Normal bar = within budget
- Amber = over 80% of budget
- Red = over budget

### Expense Autocomplete

When manually adding an expense, the description field shows suggestions from your past 500 expenses. Selecting one fills in the description, amount, category, and payment type — saving time for regular transactions.

### Dark Mode

Click the moon/sun icon at the bottom of the sidebar (desktop) or in the More drawer (mobile). Preference saved in `localStorage` and persists between sessions.

---

## Mobile / Tablet

The app is fully responsive. On mobile:

- **Bottom navigation bar** — 📊 Dashboard | ➕ Quick add | ☰ More
- **Floating + button** — opens a quick-add expense drawer optimised for one-handed use
- **All form+list pages** (Expenses, Income, Recurring, Subscriptions, Categories) follow the same mobile pattern:
  - List shows by default, full-width
  - **"+ Add" button** in the page header reveals the add form
  - Tapping **Edit** on a row reveals the edit form
  - **× button** closes the form and returns to the list
- **Subscriptions year timeline** scrolls horizontally on mobile

### Install on Android (PWA)

1. Open **Chrome** on your phone
2. Go to `https://mango-bay-041656c03.4.azurestaticapps.net`
3. Tap the **three dots** menu → **Add to Home Screen**
4. The app installs and opens full-screen like a native app

---

## Login / Authentication

Sign in with your **Microsoft account** (Hotmail, Outlook, or work account) — the primary login method. An email/password fallback is also available.

**Access restriction:** Only `mfawehinmi@hotmail.com` can use the app. Any other Microsoft account is signed out immediately on login — enforced in `App.jsx` on both session load and auth state change.

---

## Security

- **Row Level Security** on all Supabase tables — database enforces you can only read/write your own rows
- **No service_role key** in the client — only the public anon key is used
- **Email allowlist** in `App.jsx` — unauthorised users are signed out client-side even if they authenticate with Microsoft
- **Security headers** on every response (via `staticwebapp.config.json`):
  - `Content-Security-Policy` — blocks scripts from unknown sources
  - `X-Frame-Options: DENY` — prevents clickjacking
  - `X-Content-Type-Options: nosniff` — blocks MIME sniffing
  - `Strict-Transport-Security` — forces HTTPS
  - `Referrer-Policy` — prevents URL leakage
  - `Permissions-Policy` — disables camera, microphone, geolocation
- **Input sanitisation** — descriptions capped at 500 characters, notes at 1,000
- **`.env` and `*.csv` excluded from git** — keys and bank data never committed

---

## Deployment (Azure Static Apps)

The app is hosted on Azure Static Web Apps (free tier, West Europe region).

**To build and deploy:**
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

> **Important:** Use `@azure/static-web-apps-cli@2.0.4` specifically — v2.0.9 has a bug where the macOS deployment binary crashes silently. Always clear `~/.swa/deploy/` before deploying to avoid using a stale cached binary.

> Requires Azure CLI (`az`) installed and logged in (`az login`).

The `staticwebapp.config.json` file handles page routing (so refreshing `/subscriptions` doesn't return a 404) and sets all security response headers.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public anon key |

> Never commit `.env` to git.

---

## What's Excluded from Git

| Excluded | Reason |
|----------|--------|
| `node_modules/` | Too large, regenerated with `npm install` |
| `dist/` | Generated by the build, not source code |
| `.env` | Contains secret API keys |
| `*.csv` | Bank statement files contain personal financial data |
| `.claude/` | AI assistant session memory |

---

## Halifax CSV Format

The app expects this exact header row:
```
Date,Description,Type,Money In (£),Money Out (£),Balance (£)
```
Dates are in `dd MMM yy` format (e.g. `02 Mar 26`).

| Code | Meaning |
|------|---------|
| `DD` | Direct Debit |
| `SO` | Standing Order |
| `BGC` | Bank Giro Credit (salary) |
| `TFR` | Transfer |
| `CSH` | Cash deposit |
| `DEB` | Debit card payment |
| `FPO` | Faster Payment Out |
| `BP` | Bill Payment |

## Halifax PDF Format

PDF statements are parsed by extracting text items and grouping them into rows by y-coordinate (3pt tolerance). The parser finds the header row containing `Date`, `Description`, `Type`, then maps each subsequent row's values to columns by x-position proximity (within 60pt). This handles multi-word descriptions that span multiple text items in the PDF.

---

## Understanding the Code (for beginners)

### What is a `.jsx` file?
JSX is JavaScript that looks like HTML. React uses it to describe what the page should look like. Vite converts it to regular JavaScript when you run `npm run dev`.

### What is `useState`?
`useState` is how React remembers values on a page. When the value changes, the page re-renders automatically:
```jsx
const [count, setCount] = useState(0)  // count starts at 0
setCount(5)  // now count is 5, page updates
```

### What is `useEffect`?
`useEffect` runs code when something changes (like loading data when the page opens):
```jsx
useEffect(() => {
  fetchExpenses()  // runs whenever month or year changes
}, [month, year])
```

### What is Supabase?
Supabase is a cloud database. Instead of building your own server, Supabase provides one. `supabase.from('expenses').select('*')` is equivalent to `SELECT * FROM expenses` in SQL.

### What is `async/await`?
Fetching data from the internet takes time. `async/await` tells JavaScript to wait for the result:
```jsx
async function loadData() {
  const { data } = await supabase.from('expenses').select('*')
  // data is now available here
}
```

### What does Tailwind do?
Instead of separate CSS files, Tailwind uses short class names directly in JSX:
```jsx
<div className="bg-white rounded-2xl p-6">...</div>
// equivalent to: background: white; border-radius: 16px; padding: 24px;
```

### Mobile-first pattern
All pages with a form + list layout follow this pattern:
```jsx
// Outer grid — 1 column on mobile, 3 columns on desktop
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  // Form — hidden on mobile unless showMobileForm or editItem is true
  <div className={`col-span-1 ... ${showMobileForm || editItem ? 'block' : 'hidden md:block'}`}>
    ...form...
  </div>
  // List — hidden on mobile when form is showing
  <div className={`md:col-span-2 ... ${showMobileForm || editItem ? 'hidden md:block' : 'block'}`}>
    ...list...
  </div>
</div>
```
