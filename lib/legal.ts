/**
 * lib/legal.ts
 *
 * In-app Terms, Privacy, FAQ and Usage copy for Duo Wallet.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface GuideSection {
  title: string;
  body: string;
}

export const TERMS_SECTIONS: GuideSection[] = [
  {
    title: "1. The service",
    body: "Duo Wallet (“the App”) helps you and optionally a partner track personal and household money. It is a bookkeeping helper, not a bank, M-Pesa agent, lender, or financial adviser.",
  },
  {
    title: "2. Your account",
    body: "You must provide accurate signup details and keep your password private. You are responsible for activity under your account. You may sign out or delete your data by contacting the person who operates your Supabase project.",
  },
  {
    title: "3. Household ledgers",
    body: "If you create or join a household, other members can see shared transactions, balances and notes on that ledger. Invite codes grant access — only share them with people you trust. Leaving a household does not erase history you already logged there.",
  },
  {
    title: "4. M-Pesa & SMS",
    body: "Optional SMS reading and pasted confirmations are processed on your device to pre-fill amounts, fees, codes and times. You remain responsible for checking and categorising every entry before it is saved. Safaricom product names (M-Pesa, Fuliza, M-Shwari, Ziidi, Pochi la Biashara) belong to their owners.",
  },
  {
    title: "5. No advice guarantee",
    body: "Budgets, PDF reports and category totals are informational. Sharing a report with an AI or person for tips does not create professional advice. Decisions about saving, spending or debt are yours alone.",
  },
  {
    title: "6. Acceptable use",
    body: "Do not misuse the App to harm others, scrape data you do not own, or attempt to break authentication or household boundaries. We may refuse support for abusive use.",
  },
  {
    title: "7. Availability",
    body: "The App depends on your phone, network and Supabase project. Features may change. We are not liable for lost profits, incorrect totals from mistyped entries, or downtime outside our control.",
  },
  {
    title: "8. Changes",
    body: "These terms may be updated in the App. Continued use after an update means you accept the revised terms. Last updated: August 2026.",
  },
];

export const PRIVACY_SECTIONS: GuideSection[] = [
  {
    title: "What we store",
    body: "Profile name, email, colour, currency, avatar, accounts, transactions (amounts, fees, categories, notes, times), budgets, debts, recurring income/bills, and household membership. Data lives in the Supabase project configured for your build.",
  },
  {
    title: "SMS & clipboard",
    body: "If you allow SMS permission, the App reads recent inbox messages that look like Safaricom wallet confirmations, on device, to suggest ledger rows. Paste works without SMS access. We do not upload raw SMS to a third-party analytics service from this App.",
  },
  {
    title: "Photos",
    body: "Profile photos you choose are stored in your Supabase Storage (avatars bucket) and shown to household members who share a ledger with you.",
  },
  {
    title: "Sharing",
    body: "Household members see shared ledger data. PDF reports you export leave the App through your phone’s share sheet — choose recipients carefully. Push notifications for budget limits stay on device / OS channels you approve.",
  },
  {
    title: "Retention & deletion",
    body: "Data remains until you delete entries or your project admin removes your user. Sign-out keeps cloud data so you can return later.",
  },
  {
    title: "Security",
    body: "Access uses Supabase Auth and row-level security. Protect your device lock screen and never share invite codes publicly. Last updated: August 2026.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Why do I see two Fuliza SMS?",
    a: "Fuliza often sends a payment confirmation and a separate “you have used Fuliza” notice with the same M-Pesa code. Duo Wallet keeps one row per code.",
  },
  {
    q: "Is Fuliza savings?",
    a: "No. Fuliza is an overdraft (debt). M-Shwari and Ziidi are savings / money-market style pockets. Pochi la Biashara is a business wallet.",
  },
  {
    q: "Do I have to allow SMS?",
    a: "No. You can paste an SMS on Add entry or Import M-Pesa, or type amounts manually.",
  },
  {
    q: "Why must I pick a category after SMS?",
    a: "The SMS only proves money moved. You decide what it was for (groceries, savings, business, etc.). “Other” needs a short label.",
  },
  {
    q: "Are M-Pesa fees spending?",
    a: "Yes. Transaction cost is stored as fee_amount and counted in spend totals.",
  },
  {
    q: "How do I share with my partner?",
    a: "Settings → Household → create a household → share the invite code. They install the APK, sign up, and join.",
  },
  {
    q: "How do I get AI advice on spending?",
    a: "Insights → Share PDF report, then send the PDF (or its text) to ChatGPT / Claude and ask what to save or cut.",
  },
  {
    q: "Can I change theme and font?",
    a: "Settings → Appearance: light/dark, colour themes, and six fonts (DM Sans, Source Serif, Nunito, Fraunces, Lora, Literata) each with italic.",
  },
  {
    q: "Cash vs M-Pesa on a new entry?",
    a: "Pick Paid with: Cash (amount only, no fee), or M-Pesa / Bank / Card (paste SMS). Each method needs its own account with opening balance ≥ 0; live balance can go negative.",
  },
  {
    q: "Can an account balance go negative?",
    a: "Yes. Opening balance must be 0 or more, but after spending the running balance can show negative in red.",
  },
  {
    q: "Where do smokies / chapati / boiled eggs go?",
    a: "Category “Street food & snacks”. You must say what and where (e.g. smokies at stage).",
  },
];

export const USAGE_SECTIONS: GuideSection[] = [
  {
    title: "First launch",
    body: "Connect Supabase (or use a build with keys), sign up, then add accounts such as M-Pesa, M-Shwari, Ziidi or Pochi with opening balances.",
  },
  {
    title: "Add a transaction",
    body: "Tap +. Paste an M-Pesa SMS to auto-fill amount, fee, confirmation code, and date/time — then pick the category. Or type amounts yourself. Fees are spending.",
  },
  {
    title: "Import from inbox",
    body: "Settings → Import M-Pesa (Android). Allow SMS optionally. Tap a message, choose what it was for, save. Denied permission? Paste or add manually.",
  },
  {
    title: "Household",
    body: "Create a shared ledger, share the six-character code. Switch Personal / Household from the ledger control on Home.",
  },
  {
    title: "Salary, debts, budgets",
    body: "Settings → Salary & bills for monthly posts. Debts for what you owe / are owed. Budgets for category ceilings (alerts near 80% and 100%).",
  },
  {
    title: "Reports",
    body: "Insights shows trends and category split. Share PDF to review with a partner or an AI for save/cut ideas.",
  },
];
