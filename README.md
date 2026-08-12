# Duo Wallet

A financial helper for one person or a couple. Track spending, salary, debts,
accounts and budgets together — each of you on your own phone, one shared ledger
in Supabase.

Transaction fees (M-Pesa, bank charges) count as spending. Every entry keeps
the date **and** time so the ledger stays accountable.

---

## What you can do

| Area | What it is for |
| --- | --- |
| **Personal ledger** | Your private money |
| **Household ledger** | Shared with your partner via a 6-character invite code |
| **Accounts** | Cash, bank, mobile money, card — with opening balances |
| **Together totals** | On a shared ledger, combined balance + each person's opening balance |
| **Salary & bills** | Monthly income and fixed payments, posted on their day |
| **Debts** | What you owe / what is owed to you; repay from an entry |
| **Budgets** | Monthly ceilings per category |
| **Activity** | Full month ledger, searchable, grouped by day with times |
| **Theme** | Light, dark, or match the phone |

---

## How to use (day to day)

1. **Connect** — first launch asks for your Supabase URL and anon key (or bake
   them into `.env` before building the APK so both phones are ready).
2. **Sign up** — each person creates their own account (name, email, password,
   currency).
3. **Share** — one person opens **Settings → Household**, creates a household,
   and shares the invite code. The other joins with that code.
4. **Accounts** — add bank / M-Pesa / cash and set the **opening balance**
   (what is already there today). On a shared ledger, Home shows **Together**:
   combined balance and each person's opening balance.
5. **Salary** — **Settings → Salary & bills**. Add salary once (day of month +
   amount). Duo Wallet posts it automatically on payday.
6. **Debts** — **Settings → Debts**. Add loans or shop credit. When you repay,
   log an expense and pick **Pays a debt**.
7. **Log spending** — tap **+**. Pick Spent / Received / Moved. Add the
   **transaction fee** if there was one (it is spending). Set **when**
   (date and time). Both phones update live on a shared ledger.
8. **Theme** — **Settings → Theme** → Light / Dark / Match phone.

---

## One-time setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), run it.
3. Copy **Project URL** and **anon / public** key from Project Settings.
4. Either:
   - put them in `.env` (see [`.env.example`](.env.example)) before building, or
   - type them into the in-app **Connect** screen on first launch.
5. Optional: under **Authentication → Providers → Email**, turn off "Confirm
   email" for a private couple app so sign-up is instant.

The anon key is safe to ship inside an APK — every table is guarded by
row-level security in the schema.

---

## Develop / run locally

```bash
npm install
cp .env.example .env   # fill in URL + anon key
npx expo start
```

Useful scripts:

```bash
npm run typecheck
npm run lint
npm run android        # native build after `npx expo prebuild`
```

Icons (after changing the mark):

```bash
node scripts/generate-icons.mjs
```

---

## Build an APK to share

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The APK lands at:

`android/app/build/outputs/apk/release/app-release.apk`

Install on both phones. Prefer baking Supabase keys into `.env` before the
build so neither of you has to type them.

> The Expo template signs release with the debug keystore by default. Fine for
> the two of you; generate your own keystore before a public store release.

---

## Memory notes

- Data is fetched **one month at a time**.
- Inactive React Query caches are dropped after **5 minutes**.
- Personal ledgers skip realtime; only shared ledgers subscribe.
- Home shows the **5 most recent** rows; Activity is the full month list.

---

## Project layout

```
app/                 screens (Expo Router)
components/          UI + finance widgets
lib/                 supabase, queries, analytics, theme
supabase/schema.sql  database + RLS (run once)
types/               Database + app types
scripts/             icon generator
```

---

Built for two. Name: **Duo Wallet** · package `com.vorzela.duowallet`.
