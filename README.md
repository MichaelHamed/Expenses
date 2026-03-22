# 🛡️ My Pocket Guard

A personal monthly expense tracking web app built with React, Supabase, and Tailwind CSS. Designed for a single user to track spending, import Halifax bank statements, manage recurring payments, and understand their finances at a glance.

---

## What This App Does

- **Dashboard** — See income, spending, what's left, and your daily budget for the rest of the month
- **Expenses** — Add, edit, delete, search, filter and export your transactions
- **Income** — Record salary and other income
- **Import** — Upload a Halifax CSV bank statement and auto-import transactions (with duplicate detection)
- **Direct Debits** — Manage recurring Direct Debits and Standing Orders
- **Categories** — Organise spending into groups with optional monthly budget limits
- **Dark mode** — Toggle between light and dark themes

---

## Tech Stack

| Tool | What it is | Why it's used |
|------|-----------|---------------|
| **React** | JavaScript UI framework | Builds the interactive pages and components |
| **Vite** | Development server & build tool | Runs the app locally and bundles it for deployment |
| **Tailwind CSS v4** | Utility-first CSS framework | Styles every element without writing separate CSS files |
| **Supabase** | Cloud database (PostgreSQL) + Auth | Stores all your data securely online with user login |
| **React Router v7** | Page routing | Handles navigation between pages without full page reloads |
| **PapaParse** | CSV parser | Reads Halifax bank statement CSV files in the browser |
| **Recharts** | Chart library | Draws the donut chart and other visuals on the dashboard |

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
│   │   ├── Categories.jsx     # Manage spending categories + budgets
│   │   └── Login.jsx          # Login screen
│   ├── components/
│   │   └── Layout.jsx         # Sidebar navigation + dark mode toggle
│   ├── lib/
│   │   ├── supabase.js        # Supabase client (connects to your database)
│   │   └── syncRecurring.js   # Auto-adds DD/SO expenses to recurring list
│   ├── App.jsx                # Route definitions
│   ├── main.jsx               # App entry point
│   └── index.css              # Global styles + dark mode overrides
├── supabase-schema.sql        # Run once: creates main tables
├── supabase-recurring.sql     # Run once: creates recurring_payments table
├── supabase-add-payment-type.sql  # Run once: adds payment_type column
├── supabase-features.sql      # Run once: adds budget + notes columns
├── staticwebapp.config.json   # Azure Static Apps routing config
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

### Build for production (Azure deployment)
```bash
npm run build
```
This creates a `dist/` folder containing the production-ready files to deploy.

---

## Database Setup (Supabase)

You need to run these SQL files **once** in order, in the Supabase SQL Editor:

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

> All tables use **Row Level Security (RLS)** — this means each user can only see their own data, even though they share the same database tables.

---

## Key Features Explained

### Importing a Halifax Bank Statement

1. Log into Halifax online banking
2. Go to **Statements** → select the month → **Download** → choose **CSV**
3. In My Pocket Guard, go to **Import** → upload the CSV
4. The app detects it's a Halifax file and parses each row
5. **Duplicate detection** — rows that already exist in your records are flagged with a yellow "DUPLICATE" badge and unticked automatically
6. **Auto-categorisation** — descriptions are matched against a keyword list (e.g. "ALDI" → Food & Drink), and against your previously categorised transactions (learned memory)
7. **Money In** — salary, cash deposits, and transfers in are detected and shown separately as income to add
8. **DD / SO detection** — the bank's Type column (DD = Direct Debit, SO = Standing Order) is used to tag those transactions automatically, and they are synced to your Direct Debits list

### Salary Paid on the 28th

Halifax pays salary on the 28th of each month for the **following** month. The dashboard accounts for this by looking back to the 25th of the previous month when calculating your current month's income, so March's dashboard correctly shows the February 28th salary.

### Direct Debits & Standing Orders

When an expense is tagged as DD or SO (either during import or when manually added), it is automatically synced to the **Direct Debits** page. This page shows:
- All your recurring payments with type, amount, day of month, and category
- Summary totals for DDs and SOs separately
- The Dashboard "Upcoming Payments" panel shows any due within 14 days

### Budget Targets

In **Categories**, you can set a monthly budget limit for each category (e.g. Groceries: £300). On the Dashboard category breakdown:
- Green/colour bar = within budget
- Amber = over 80% of budget ("Near limit")
- Red = over budget ("Over budget!")

### Dark Mode

Click the moon/sun icon at the bottom of the sidebar. The preference is saved in your browser (`localStorage`) so it persists between sessions.

---

## Understanding the Code (for beginners)

### What is a `.jsx` file?
JSX is JavaScript that looks like HTML. React uses it to describe what the page should look like. For example:
```jsx
function MyComponent() {
  return <h1>Hello, world!</h1>
}
```
The browser doesn't understand JSX directly — Vite converts it to regular JavaScript when you run `npm run dev`.

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
  fetchExpenses()  // runs when month or year changes
}, [month, year])
```

### What is Supabase?
Supabase is a cloud database. Instead of building your own server, Supabase provides one. In the code, `supabase.from('expenses').select('*')` is a database query — the same as `SELECT * FROM expenses` in SQL.

### What is `async/await`?
Fetching data from the internet takes time. `async/await` tells JavaScript to wait for the result before continuing:
```jsx
async function loadData() {
  const { data } = await supabase.from('expenses').select('*')
  // data is now available here
}
```

### What does Tailwind do?
Instead of writing CSS like:
```css
.card { background: white; border-radius: 16px; padding: 24px; }
```
Tailwind uses short class names directly in the HTML:
```jsx
<div className="bg-white rounded-2xl p-6">...</div>
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public anon key |

> The `.env` file is listed in `.gitignore` so it is never committed to git — your keys stay private.

---

## Deployment (Azure Static Apps)

The `staticwebapp.config.json` file tells Azure how to handle page routing so that refreshing a page like `/expenses` works correctly (instead of showing a 404).

To deploy:
1. Run `npm run build` — creates the `dist/` folder
2. Upload the `dist/` folder contents to your Azure Static App

---

## What's Excluded from Git

The `.gitignore` file prevents these from being committed:
- `node_modules/` — too large, regenerated with `npm install`
- `dist/` — generated by the build, not source code
- `.env` — contains secret API keys
- `*.csv` — bank statement files contain personal financial data
- `.claude/` — AI assistant session memory

---

## Halifax CSV Format

The app expects this exact header row (Halifax format):
```
Date,Description,Type,Money In (£),Money Out (£),Balance (£)
```
Dates are in `dd MMM yy` format (e.g. `02 Mar 26`).

The `Type` column values used for detection:
- `DD` = Direct Debit
- `SO` = Standing Order
- `BGC` = Bank Giro Credit (salary)
- `TFR` = Transfer
- `CSH` = Cash deposit
- `DEB` = Debit card payment
- `FPO` = Faster Payment Out
- `BP` = Bill Payment (e.g. Save the Change)
