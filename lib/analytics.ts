/**
 * lib/analytics.ts
 *
 * Pure derivations over transaction rows: totals, breakdowns, pace and budget
 * health. No Supabase, no React — everything here is a function of its inputs,
 * which keeps the screens dumb and the numbers testable.
 *
 * Transfers are deliberately excluded from spend and income: moving money
 * between your own accounts is not a purchase, and counting it would double
 * every withdrawal. Their *fees* are still spending, though — see below.
 *
 * Two rules about transaction costs, applied consistently everywhere:
 *   1. A fee is spending, whatever kind of transaction carried it. Receiving
 *      money and paying 30 bob to receive it means 30 bob left the house.
 *   2. A fee is attributed to the "Transaction fees" category rather than the
 *      parent transaction's, so the breakdown answers "how much do charges
 *      cost us?" — which is the whole reason for tracking them separately.
 */

import { FEES_CATEGORY_ID, getCategory } from "@/lib/categories";
import {
  addMonths,
  dayKeyOf,
  daysInMonth,
  monthDayKeys,
  monthProgress,
  toDayKey,
  toMonthKey,
} from "@/lib/date";
import type { BudgetRow, TransactionRow } from "@/types/database";
import type {
  BudgetHealth,
  BudgetStatus,
  CategorySummary,
  CoupleBalance,
  DayPoint,
  Member,
  MemberSummary,
  MonthOverview,
  MonthPoint,
  Totals,
} from "@/types/finance";

/** Ratio of a budget at which the UI turns amber, then red. */
export const CAUTION_RATIO = 0.8;
export const OVER_RATIO = 1;

const EMPTY_TOTALS: Totals = { spent: 0, earned: 0, net: 0, fees: 0, count: 0 };

interface AmountLike {
  kind: TransactionRow["kind"];
  amount: number;
  fee_amount: number;
}

export function computeTotals(rows: AmountLike[]): Totals {
  let spent = 0;
  let earned = 0;
  let fees = 0;
  let count = 0;

  for (const row of rows) {
    fees += row.fee_amount;
    // The charge is spending on every kind, including transfers and income.
    spent += row.fee_amount;

    if (row.kind === "expense") {
      spent += row.amount;
      count += 1;
    } else if (row.kind === "income") {
      earned += row.amount;
      count += 1;
    }
  }

  return { spent, earned, net: earned - spent, fees, count };
}

interface CategorisedAmount extends AmountLike {
  category_id: string;
}

/** Expense totals per category, largest first. Fees form their own slice. */
export function categoryBreakdown(rows: CategorisedAmount[]): CategorySummary[] {
  const totals = new Map<string, { total: number; count: number }>();
  let grand = 0;

  const add = (categoryId: string, amount: number) => {
    const entry = totals.get(categoryId) ?? { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    totals.set(categoryId, entry);
    grand += amount;
  };

  for (const row of rows) {
    if (row.fee_amount > 0) add(FEES_CATEGORY_ID, row.fee_amount);
    if (row.kind === "expense") add(row.category_id, row.amount);
  }

  return [...totals.entries()]
    .map(([categoryId, entry]) => {
      const category = getCategory(categoryId);
      return {
        categoryId,
        label: category.label,
        color: category.color,
        total: entry.total,
        count: entry.count,
        share: grand === 0 ? 0 : entry.total / grand,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Per-person split. Members with no activity are kept so the list is stable. */
export function memberBreakdown(
  rows: (AmountLike & { user_id: string })[],
  members: Member[],
): MemberSummary[] {
  const totals = new Map<string, { spent: number; earned: number; count: number }>();
  let grandSpent = 0;

  for (const row of rows) {
    const entry = totals.get(row.user_id) ?? { spent: 0, earned: 0, count: 0 };

    entry.spent += row.fee_amount;
    grandSpent += row.fee_amount;

    if (row.kind === "expense") {
      entry.spent += row.amount;
      entry.count += 1;
      grandSpent += row.amount;
    } else if (row.kind === "income") {
      entry.earned += row.amount;
      entry.count += 1;
    }
    totals.set(row.user_id, entry);
  }

  return members
    .map((member) => {
      const entry = totals.get(member.id) ?? { spent: 0, earned: 0, count: 0 };
      return {
        member,
        spent: entry.spent,
        earned: entry.earned,
        count: entry.count,
        share: grandSpent === 0 ? 0 : entry.spent / grandSpent,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

/** One point per day of the month, with a running total for the area chart. */
export function dailySpend(
  monthKey: string,
  rows: (AmountLike & { occurred_at: string })[],
): DayPoint[] {
  const perDay = new Map<string, number>();

  for (const row of rows) {
    const spent = (row.kind === "expense" ? row.amount : 0) + row.fee_amount;
    if (spent === 0) continue;
    const dayKey = dayKeyOf(row.occurred_at);
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + spent);
  }

  let running = 0;
  return monthDayKeys(monthKey).map((dayKey) => {
    const spent = perDay.get(dayKey) ?? 0;
    running += spent;
    return { dayKey, spent, cumulative: running };
  });
}

/** Spend and income per month across a window, oldest first. Fills gaps with zeros. */
export function fillMonthHistory(
  points: Pick<MonthPoint, "monthKey" | "spent" | "earned">[],
  monthKey: string,
  months: number,
): MonthPoint[] {
  const buckets = new Map<string, MonthPoint>();
  const [year, month] = monthKey.split("-").map(Number);

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - 1 - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { monthKey: key, spent: 0, earned: 0 });
  }

  for (const point of points) {
    const bucket = buckets.get(point.monthKey);
    if (!bucket) continue;
    bucket.spent = point.spent;
    bucket.earned = point.earned;
  }

  return [...buckets.values()];
}

function healthFor(ratio: number): BudgetHealth {
  if (ratio >= OVER_RATIO) return "over";
  if (ratio >= CAUTION_RATIO) return "caution";
  return "ok";
}

/**
 * Budget rows paired with what has actually been spent. A budget with no
 * `category_id` covers the whole month's spend.
 */
export function budgetStatuses(
  budgets: BudgetRow[],
  rows: CategorisedAmount[],
  monthKey: string,
): BudgetStatus[] {
  const spentPerCategory = new Map<string, number>();
  let totalSpent = 0;

  const add = (categoryId: string, amount: number) => {
    spentPerCategory.set(categoryId, (spentPerCategory.get(categoryId) ?? 0) + amount);
    totalSpent += amount;
  };

  for (const row of rows) {
    if (row.fee_amount > 0) add(FEES_CATEGORY_ID, row.fee_amount);
    if (row.kind === "expense") add(row.category_id, row.amount);
  }

  const { daysRemaining } = monthProgress(monthKey);

  return budgets
    .filter((budget) => budget.month === null || budget.month === monthKey)
    .map((budget) => {
      const spent = budget.category_id
        ? (spentPerCategory.get(budget.category_id) ?? 0)
        : totalSpent;
      const limit = budget.limit_amount;
      const remaining = limit - spent;
      const ratio = limit === 0 ? 0 : spent / limit;
      const category = budget.category_id ? getCategory(budget.category_id) : null;

      return {
        budget,
        categoryId: budget.category_id,
        label: category?.label ?? "Everything",
        color: category?.color ?? "#1e3a5f",
        limit,
        spent,
        remaining,
        ratio,
        health: healthFor(ratio),
        dailyAllowance:
          daysRemaining > 0 ? Math.max(0, Math.floor(remaining / daysRemaining)) : 0,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * Straight-line projection of where the month lands at the current pace. Past
 * months are already final, so they project to themselves.
 */
export function projectSpend(monthKey: string, spent: number): number {
  const { elapsedRatio } = monthProgress(monthKey);
  if (elapsedRatio <= 0) return 0;
  if (elapsedRatio >= 1) return spent;
  return Math.round(spent / elapsedRatio);
}

export interface OverviewInput {
  monthKey: string;
  rows: TransactionRow[];
  previousSpent: number;
  members: Member[];
  budgets: BudgetRow[];
}

/** Everything the dashboard needs, computed in one place. */
export function buildOverview({
  monthKey,
  rows,
  previousSpent,
  members,
  budgets,
}: OverviewInput): MonthOverview {
  const totals = rows.length === 0 ? EMPTY_TOTALS : computeTotals(rows);
  const statuses = budgetStatuses(budgets, rows, monthKey);

  return {
    monthKey,
    totals,
    previousSpent,
    changeRatio:
      previousSpent === 0 ? null : (totals.spent - previousSpent) / previousSpent,
    categories: categoryBreakdown(rows),
    members: memberBreakdown(rows, members),
    days: dailySpend(monthKey, rows),
    projectedSpend: projectSpend(monthKey, totals.spent),
    topBudget: statuses[0] ?? null,
  };
}

/**
 * Folds the per-member balances from the database into the household picture:
 * one total, plus who is holding what. Members with no accounts still appear,
 * so a partner who has not set theirs up yet is visible rather than missing.
 */
export function coupleBalance(
  rows: { user_id: string; opening_balance: number; balance: number }[],
  members: Member[],
): CoupleBalance {
  const byMember = new Map(rows.map((row) => [row.user_id, row]));

  const perMember = members.map((member) => {
    const row = byMember.get(member.id);
    return {
      member,
      openingBalance: row?.opening_balance ?? 0,
      balance: row?.balance ?? 0,
    };
  });

  return {
    total: perMember.reduce((sum, entry) => sum + entry.balance, 0),
    openingTotal: perMember.reduce((sum, entry) => sum + entry.openingBalance, 0),
    perMember: [...perMember].sort((a, b) => b.balance - a.balance),
  };
}

/** Household totals from per-account balances, without a second database round trip. */
export function coupleBalanceFromAccounts(
  accounts: { owner_id: string; opening_balance: number; balance: number }[],
  members: Member[],
): CoupleBalance {
  const rows = new Map<string, { user_id: string; opening_balance: number; balance: number }>();

  for (const account of accounts) {
    const row = rows.get(account.owner_id) ?? {
      user_id: account.owner_id,
      opening_balance: 0,
      balance: 0,
    };
    row.opening_balance += account.opening_balance;
    row.balance += account.balance;
    rows.set(account.owner_id, row);
  }

  return coupleBalance([...rows.values()], members);
}

/**
 * The next day a recurring entry will turn into a transaction. An entry whose
 * day has already gone by this month — or which has already posted — moves to
 * next month.
 */
export function nextPostDate(
  entry: { day_of_month: number; last_posted_month: string | null },
  today: Date = new Date(),
): string {
  const thisMonth = toMonthKey(toDayKey(today));
  const postedAlready = entry.last_posted_month === thisMonth;
  const dueThisMonth = entry.day_of_month >= today.getDate();

  const monthKey = !postedAlready && dueThisMonth ? thisMonth : addMonths(thisMonth, 1);
  // Clamp so a "31st" entry lands on the last day of a short month.
  const day = Math.min(entry.day_of_month, daysInMonth(monthKey));
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export interface DaySection<T> {
  dayKey: string;
  rows: T[];
  /** Net movement for the day: income minus spend. */
  net: number;
}

/** Groups rows into day sections for the activity list, newest day first. */
export function groupByDay<T extends AmountLike & { occurred_at: string }>(
  rows: T[],
): DaySection<T>[] {
  const sections = new Map<string, T[]>();

  for (const row of rows) {
    const dayKey = dayKeyOf(row.occurred_at);
    const bucket = sections.get(dayKey);
    if (bucket) bucket.push(row);
    else sections.set(dayKey, [row]);
  }

  return [...sections.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dayKey, dayRows]) => {
      const totals = computeTotals(dayRows);
      return {
        dayKey,
        // Latest first within the day, which is why the time is worth storing.
        rows: [...dayRows].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
        net: totals.net,
      };
    });
}
