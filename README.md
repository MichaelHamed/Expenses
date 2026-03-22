# 🛡️ My Pocket Guard

A personal monthly expense tracking web app built with React, Supabase, and Tailwind CSS. Designed for a single user to track spending, import Halifax bank statements, manage recurring payments, and understand their finances at a glance.

Live at: **https://mango-bay-041656c03.4.azurestaticapps.net**

---

## What This App Does

- **Dashboard** — See income, spending, remaining budget, daily allowance, and month progress at a glance
- **Expenses** — Add, edit, delete, search, filter and export your transactions
- **Income** — Record salary and other income entries
- **Import** — Upload a Halifax CSV bank statement and auto-import transactions (with duplicate detection)
- **Direct Debits** — Manage recurring Direct Debits and Standing Orders
- **Analytics** — Annual income vs spending charts, savings rate, top merchants, month-over-month comparison
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
| **Recharts** | Chart library | Draws charts on the dashboard and analytics pages |

---

## Project Structure

```
Expenses/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      # Main overview page
│   │   ├── Expenses.jsx       # Add/edit/delete/search expenses
│   │   ├── Income.jsx         # Record income entries
│   │   ├── Import.jsx         # Upload & import bank statement CSV
│   │   ├── Recurring.jsx      # Manage Direct Debits & Standing Orders
│   │   ├── Analytics.jsx      # Charts, top merchants, year summary
│   │   ├── Categories.jsx     # Manage spending categories + budgets
│   │   └── Login.jsx          # Microsoft SSO + email login screen
│   ├── components/
│   │   └── Layout.jsx         # Sidebar (desktop) + bottom nav (mobile)
│   ├── lib/
│   │   ├── supabase.js        # Supabase client (connects to your database)
│   │   └── syncRecurring.js   # Auto-adds DD/SO expenses to recurring list
│   ├── App.jsx                # Route definitions
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
├── Dockerfile                 # For local network deployment via Docker
├── nginx.conf                 # Nginx config used by Docker
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

2. **Install dependencies** — this downloads all the libraries listed in `package.json`:
   ```bash
   npm install
   ```
   > This creates a `node_modules/` folder. You never edit this folder — it's managed automatically.

3. **Create your environment file** — create a file called `.env` in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   > Get these values from: Supabase Dashboard → Your Project → Settings → API

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   > Open your browser at `http://localhost:5173`

5. **To stop the server**, press `Ctrl + C` in the terminal

---

## Database Setup (Supabase)

Run these SQL files **once** in order in the Supabase SQL Editor:

**How to run SQL in Supabase:**
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Paste the SQL → Click **Run**

**Run in this order:**

| File | What it creates |
|------|----------------|
| `supabase-schema.sql` | `categories`, `expenses`, `income_entries` tables + security rules |
| `supabase-recurring.sql` | `recurring_payments` table for Direct Debits & Standing Orders |
| `supabase-add-payment-type.sql` | Adds `payment_type` column to expenses (DD / SO / null) |
| `supabase-features.sql` | Adds `budget` to categories and `notes` to expenses |

> All tables use **Row Level Security (RLS)** — each user can only ever see their own data, even if multiple people use the same Supabase project.

---

## Key Features Explained

### Dashboard

- Shows income, spent, remaining, and daily budget for the rest of the month
- **Month progress bar** — how far through the month you are
- **Daily budget** — remaining money divided by days left in the month
- **vs last month** — how this month's spending compares to the previous month (red = spending more, green = spending less)
- **Category breakdown** — bar chart of spending per category with budget progress bars
- **Income Utilisation gauge** — visual showing what % of income has been spent

### Importing a Halifax Bank Statement

1. Log into Halifax online banking
2. Go to **Statements** → select the month → **Download** → choose **CSV**
3. In My Pocket Guard, go to **Import** → upload the CSV
4. The app detects it's a Halifax file and parses each row
5. **Duplicate detection** — rows that already exist in your records are flagged with a yellow "DUPLICATE" badge and unticked automatically
6. **Auto-categorisation** — descriptions are matched against a keyword list (e.g. "ALDI" → Food & Drink), and against your previously categorised transactions (learned memory)
7. **Money In** — salary, cash deposits, and transfers in are detected and shown separately as income to add
8. **DD / SO detection** — the bank's Type column tags those transactions automatically, and they are synced to your Direct Debits list

### Salary Paid on the 28th

Halifax pays salary on the 28th of each month for the **following** month. The dashboard accounts for this by looking back to the 25th of the previous month when calculating your current month's income, so March's dashboard correctly shows the February 28th salary as March income.

### Expense Autocomplete

When manually adding an expense, typing in the description field shows suggestions from your past 500 expenses. Selecting one fills in the description, amount, category, and payment type automatically — saving time for regular transactions.

### Direct Debits & Standing Orders

When an expense is tagged as DD or SO (either during import or when manually added), it is automatically synced to the **Direct Debits** page. This page shows:
- All your recurring payments with type, amount, day of month, and category
- Summary totals for DDs and SOs separately
- The Dashboard shows upcoming payments due within the next 14 days

### Budget Targets

In **Categories**, you can set a monthly budget limit for each category (e.g. Groceries: £300). On the Dashboard category breakdown:
- Normal bar = within budget
- Amber = over 80% of budget
- Red = over budget

### Analytics

- **Annual chart** — income vs spending bar chart for every month of the year
- **Savings rate** — line chart showing % of income saved each month
- **Highlights** — best and worst savings months of the year
- **Top merchants** — ranked list of where your money goes with bar chart
- **Month-over-month** — spending per category for the last 3 months with trend arrows

### Dark Mode

Click the moon/sun icon at the bottom of the sidebar (desktop) or in the More drawer (mobile). The preference is saved in your browser and persists between sessions.

---

## Mobile / Tablet

The app is fully responsive. On mobile you get:

- **Bottom navigation bar** with two items:
  - 📊 **Dashboard** — your main view
  - **☰ More** — opens a drawer with all other pages
- **Floating + button** (centre of bottom bar) — opens a quick-add expense form as a slide-up drawer, optimised for one-handed use with large touch targets
- All pages (Expenses, Analytics, etc.) use stacked single-column layouts on small screens

### Install on Android (PWA)

You can install the app on your Android phone without any app store:

1. Open **Chrome** on your phone
2. Go to `https://mango-bay-041656c03.4.azurestaticapps.net`
3. Tap the **three dots** menu → **Add to Home Screen**
4. The app installs and opens full-screen like a native app

---

## Login / Authentication

Sign in with your **Microsoft account** (hotmail, outlook, or work account) — this is the primary login method. An email/password fallback is also available via "Sign in with email instead".

The app uses Supabase Auth with Azure AD OAuth. Your Microsoft identity is verified by Microsoft, and Supabase issues a session token. All data queries require a valid session.

---

## Security

The following security measures are in place:

- **Row Level Security** on all Supabase tables — database enforces that you can only read/write your own rows
- **No service_role key** in the client — only the public anon key is used, which is safe to expose
- **Security headers** on every response:
  - `Content-Security-Policy` — blocks scripts from unknown sources
  - `X-Frame-Options: DENY` — prevents clickjacking
  - `X-Content-Type-Options: nosniff` — blocks MIME sniffing
  - `Strict-Transport-Security` — forces HTTPS
  - `Referrer-Policy` — prevents URL leakage to third parties
  - `Permissions-Policy` — disables camera, microphone, geolocation
- **Input sanitisation** — descriptions capped at 500 characters, notes at 1,000
- **`.env` and `*.csv` excluded from git** — keys and bank statement data never committed

---

## Deployment (Azure Static Apps)

The app is hosted on Azure Static Web Apps (free tier, West Europe region).

**To build and deploy:**
```bash
npm run build && npx @azure/static-web-apps-cli deploy dist \
  --deployment-token $(az staticwebapp secrets list \
    --name my-pocket-guard \
    --resource-group pocket-guard-rg \
    --query "properties.apiKey" -o tsv) \
  --env production
```

> Requires Azure CLI (`az`) to be installed and logged in (`az login`).

The `staticwebapp.config.json` file tells Azure how to handle page routing (so refreshing `/expenses` doesn't return a 404) and sets all security response headers.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public anon key |

> The `.env` file is in `.gitignore` and is never committed to git.

---

## What's Excluded from Git

The `.gitignore` file prevents these from being committed:

| Excluded | Reason |
|----------|--------|
| `node_modules/` | Too large, regenerated with `npm install` |
| `dist/` | Generated by the build, not source code |
| `.env` | Contains secret API keys |
| `*.csv` | Bank statement files contain personal financial data |
| `.claude/` | AI assistant session memory |

---

## Halifax CSV Format

The app expects this exact header row (Halifax format):
```
Date,Description,Type,Money In (£),Money Out (£),Balance (£)
```
Dates are in `dd MMM yy` format (e.g. `02 Mar 26`).

The `Type` column values used for detection:

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
Supabase is a cloud database. Instead of building your own server, Supabase provides one. In the code, `supabase.from('expenses').select('*')` is the same as `SELECT * FROM expenses` in SQL.

### What is `async/await`?
Fetching data from the internet takes time. `async/await` tells JavaScript to wait for the result before continuing:
```jsx
async function loadData() {
  const { data } = await supabase.from('expenses').select('*')
  // data is now available here
}
```

### What does Tailwind do?
Instead of writing separate CSS files, Tailwind uses short class names directly in the HTML:
```jsx
<div className="bg-white rounded-2xl p-6">...</div>
// equivalent to: background: white; border-radius: 16px; padding: 24px;
```
