# Commercialising Flōw — A Practical Guide

This document covers everything needed to turn Flōw from a personal app into a product you could charge real users for. It's written honestly — covering what's already done, what needs changing, what it costs, and what the competition looks like.

---

## What You Already Have (That Most Startups Don't)

The hard parts are further along than you might think:

| Already built | Why it matters commercially |
|--------------|----------------------------|
| Multi-user database (Supabase RLS) | Every user is already isolated — no re-architecture needed |
| Microsoft SSO + email login | Professional auth out of the box |
| Bank statement import (CSV + PDF) | Biggest friction point for finance apps — you solved it |
| Subscription + DD tracking | Niche that major apps (Emma, Monzo) handle badly |
| Email alerts (Supabase Edge Function) | Engagement loop already wired |
| PWA (installable, works offline) | No App Store approval needed to launch |
| Excel export | Feature users will pay for |
| Dark mode | Table stakes for a finance app in 2025 |
| Pay-period budgeting | Genuinely differentiating — competitors use calendar months |

---

## What Needs to Change to Go Multi-User

### 1. Remove the email allowlist

In `src/App.jsx`, there is a check that only allows `mfawehinmi@hotmail.com`. Remove this guard and replace it with a proper sign-up flow.

```jsx
// Remove this block from App.jsx:
if (session.user.email !== 'mfawehinmi@hotmail.com') {
  await supabase.auth.signOut()
}
```

Replace with: email verification (already built into Supabase), and optionally a waitlist or invite system for early access.

### 2. Remove hardcoded personal data

- **`SEED` array in `Subscriptions.jsx`** — the pre-loaded subscriptions (Microsoft 365, Amazon Prime, NordVPN, etc.) are your personal data. Replace with a generic starter set or remove entirely.
- **`ALERT_EMAIL` Supabase secret** — this must become per-user, stored in the database.
- **Payday date (28th)** — this is hardcoded to your employer's pay schedule. Make it a user setting.

### 3. Make payday configurable

Currently `getActualPayday()` hardcodes the 28th. For a commercial app:

```js
// Store in a user_settings table:
{ user_id, payday: 28, payday_rule: 'last_working_day' }
```

Add a Settings page where users set their payday. This is a major UX differentiator vs competitors.

### 4. Per-user email alerts

The Edge Function currently emails one hardcoded address. Refactor it to:
1. Query all users from `auth.users`
2. For each user, check their upcoming renewals/DDs
3. Send individually

Or use Supabase's webhook system to trigger per-user on a schedule.

### 5. Bank connection (Open Banking)

Currently users upload CSV/PDF manually. For a commercial product, you want automatic bank sync. Options:

| Provider | Cost | Coverage |
|----------|------|---------|
| **TrueLayer** | ~£0.10–0.50/connection/month | UK, EU, US |
| **Plaid** | ~$0.30/connection/month | UK (limited), US |
| **Yapily** | Custom pricing | UK, EU |
| **Nordigen (GoCardless)** | Free for personal use, paid commercial | EU/UK |

For a UK-first product, **TrueLayer** or **Nordigen** are the most practical starting points. Integration requires FCA authorisation or partnering with an authorised provider.

> **Note:** Open Banking in the UK requires you to be an FCA-registered AISP (Account Information Service Provider) or work through a regulated partner. This is a significant legal step — budget 3–6 months and £5,000–£20,000 for initial compliance.

---

## Billing & Subscriptions

Use **Stripe** to charge users. The standard approach:

```
Free tier → Paid tier (monthly/annual)
```

Suggested tiers for a UK personal finance app:

| Tier | Price | Features |
|------|-------|---------|
| **Free** | £0/month | 3 months of expenses, manual import, 5 categories |
| **Plus** | £3.99/month | Unlimited history, PDF import, subscriptions tracker, email alerts |
| **Pro** | £7.99/month | Everything + Excel export, Open Banking sync, priority support |

**Stripe integration steps:**
1. Create a Stripe account at stripe.com
2. Add `stripe` npm package
3. Create a Supabase Edge Function (`create-checkout`) that creates a Stripe checkout session
4. Add a `subscriptions` table to track which users are on which plan
5. Use Stripe webhooks to update plan status on payment/cancellation
6. Gate features in the UI based on plan

Tools that make this faster: **Stripe Billing** (handles renewals, failed payments, proration automatically).

---

## Legal Requirements

### Privacy Policy
You **must** have one before taking any real user data. Must cover:
- What data you collect (transactions, bank statements, email)
- Where it's stored (Supabase — EU region for GDPR compliance)
- How long you keep it
- User rights (access, deletion, export)
- Cookie usage

Use a generator like **Termly** or **iubenda** for a first draft (~£10–30/year), then get it reviewed by a solicitor before launch.

### Terms of Service
Covers liability, acceptable use, and cancellation. Critical because you're handling financial data.

### GDPR (UK)
As a UK-based service handling personal financial data:
- Register with the **ICO** (Information Commissioner's Office) — £40/year for micro-businesses
- Implement a data deletion endpoint (user can request all their data be deleted)
- Add cookie consent if you ever add analytics scripts

In Supabase, data deletion is straightforward — deleting a user from `auth.users` cascades to all RLS-protected tables if set up with `on delete cascade` (which your schema already does).

### Financial Promotions
If you make claims like "save more money" or "manage your finances better," these may fall under FCA financial promotion rules. Keep marketing language factual and avoid anything that sounds like financial advice.

---

## Infrastructure Costs at Scale

Current setup costs: **~£0/month** (all free tiers).

Projected costs as you scale:

| Users | Supabase | Azure Static Apps | Resend | Total/month |
|-------|----------|-------------------|--------|-------------|
| 0–500 | Free | Free | Free | £0 |
| 500–2,000 | £25 (Pro) | Free | £15 | £40 |
| 2,000–10,000 | £25–£100 | Free | £40 | £65–£140 |
| 10,000+ | Custom | £9 (Standard) | Custom | £150+ |

**When to upgrade Supabase:** At ~500 users you'll need the Pro plan for more database space and Edge Function invocations. The jump from free to Pro is £25/month.

---

## Competitive Landscape

| App | Price | Strengths | Where Flōw is better |
|-----|-------|-----------|----------------------|
| **Emma** | £4.99–£9.99/mo | Open Banking, AI insights | Pay-period budgeting, DD weekend rules |
| **Monzo** | Free–£17/mo | Banking + budgeting in one | Works with any bank |
| **YNAB** | £14.99/mo | Zero-based budgeting | Cheaper, UK-first, simpler UX |
| **Snoop** | Free–£4.99/mo | Switching deals, comparisons | No upsell, more control |
| **Copilot** (US) | $13/mo | Beautiful UI, investment tracking | UK-focused, Halifax import |

**Flōw's differentiation:**
1. **Pay-period budgeting** — no competitor adjusts for your actual payday
2. **Subscription vs DD separation** — most apps lump these together
3. **Halifax PDF import** — nobody else does this out of the box
4. **Offline-capable PWA** — works without an app store

---

## Recommended Launch Path

### Phase 1 — Private beta (1–2 months)
- Remove the email allowlist, invite 10–20 friends/family
- Make payday configurable (user settings)
- Add basic privacy policy and terms
- Register with ICO (£40)
- Set up Stripe in test mode

### Phase 2 — Public soft launch (month 3)
- Launch on **Product Hunt** and **Reddit** (r/UKPersonalFinance, r/financialindependence)
- Free tier only — focus on getting users, not revenue
- Add Google Analytics or Plausible for usage tracking
- Collect feedback via a simple feedback button

### Phase 3 — Monetisation (month 4–6)
- Enable Stripe billing — introduce paid tier
- Target: 1,000 free users, 50 paying users = ~£200/month
- Add one Open Banking integration (Nordigen/TrueLayer)

### Phase 4 — Growth (month 6–12)
- Open Banking fully integrated
- Apply for FCA AISP status or partner with a regulated provider
- SEO content: "how to budget on a monthly salary", "best budgeting apps UK"
- Target: £1,000 MRR

---

## Quick Wins Before Launch

These are low-effort, high-value changes to do before showing anyone:

1. **User settings page** — payday date, currency, name — currently hardcoded
2. **Data export** — let users download all their data as a ZIP (GDPR compliance + trust)
3. **Onboarding flow** — new users need a guided first experience (currently lands on Dashboard with no data)
4. **Error monitoring** — add Sentry (free tier) so you know when things break in production
5. **Remove personal subscription data** from the SEED array in `Subscriptions.jsx`
6. **Custom domain** — `flowapp.co.uk` or `useflow.app` would cost ~£10/year and look professional

---

## Estimated Total Cost to Launch (MVP)

| Item | One-off | Monthly |
|------|---------|---------|
| ICO registration | £40 | — |
| Privacy policy (Termly) | — | £10 |
| Custom domain | £10 | — |
| Supabase Pro (at scale) | — | £25 |
| Resend (at scale) | — | £15 |
| Stripe (% of revenue) | — | 1.4% + 20p per transaction |
| **Total to first paying customer** | **~£50** | **~£50** |

This is an unusually low cost to launch. Most SaaS products need £5,000–£50,000 before they can take a payment. Flōw's architecture means you could be charging real customers for under £100 total outlay.

---

## Summary

Flōw is closer to a commercial product than most personal projects ever get. The database is multi-user ready, the auth is solid, the core features are genuinely differentiated, and the stack is cheap to run.

The three things that would move the needle most before charging money:

1. **Make payday configurable** — this is the #1 feature that makes Flōw different, and it needs to work for anyone's pay schedule
2. **Remove hardcoded personal data** — subscriptions seed, email address
3. **Add a privacy policy and ICO registration** — legally required before taking real user data

Everything else can be iterated on with paying customers.
