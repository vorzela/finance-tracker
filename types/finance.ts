/**
 * types/finance.ts
 *
 * App-level shapes layered on top of the raw table rows in `types/database.ts`:
 * the scope a screen is looking at, the drafts forms produce, and the summaries
 * `lib/analytics.ts` derives for the dashboard.
 *
 * Money is always minor units (cents) as an integer.
 */

import type {
  AccountRow,
  AccountType,
  BudgetRow,
  DebtDirection,
  DebtRow,
  GroupRow,
  MemberRole,
  RecurringEntryRow,
  RecurringKind,
  TransactionKind,
  TransactionRow,
} from "@/types/database";

export type { AccountType, DebtDirection, MemberRole, RecurringKind, TransactionKind };

/**
 * Which ledger the app is showing. `personal` is private to the signed-in user;
 * `group` is shared with everyone in that household.
 */
export type Scope =
  | { kind: "personal" }
  | { kind: "group"; groupId: string };

export const PERSONAL_SCOPE: Scope = { kind: "personal" };

/** The value that goes in a `group_id` column for a scope. */
export function scopeGroupId(scope: Scope): string | null {
  return scope.kind === "group" ? scope.groupId : null;
}

/** Stable string for React Query keys and AsyncStorage. */
export function scopeKey(scope: Scope): string {
  return scope.kind === "group" ? `group:${scope.groupId}` : "personal";
}

export function parseScopeKey(value: string | null | undefined): Scope | null {
  if (!value) return null;
  if (value === "personal") return PERSONAL_SCOPE;
  if (value.startsWith("group:")) {
    const groupId = value.slice("group:".length);
    return groupId ? { kind: "group", groupId } : null;
  }
  return null;
}

/** A household plus the caller's standing in it. */
export interface GroupSummary extends GroupRow {
  role: MemberRole;
  memberCount: number;
}

/** A person shown on a shared ledger. */
export interface Member {
  id: string;
  name: string;
  color: string;
  role: MemberRole;
  /** True for the signed-in user, used for "You" labels. */
  isSelf: boolean;
}

export interface Account extends AccountRow {
  /** Opening balance plus every transaction that touched it. */
  balance: number;
}

/** A transaction with the labels a list row needs already resolved. */
export interface TransactionView extends TransactionRow {
  /** The person's actual name, used for avatar initials. */
  memberName: string;
  /** What to print: "You" for the signed-in user, otherwise the name. */
  memberLabel: string;
  memberColor: string;
  isSelf: boolean;
  accountName: string | null;
  toAccountName: string | null;
  /** `amount + fee_amount` — what actually left the account. */
  totalAmount: number;
  debtName: string | null;
}

export type TransactionDraft = {
  kind: TransactionKind;
  amount: number;
  /** The transaction cost. Zero when there was no charge. */
  feeAmount: number;
  categoryId: string;
  accountId: string | null;
  toAccountId: string | null;
  debtId: string | null;
  note: string | null;
  /** ISO timestamp: the moment it happened, not just the day. */
  occurredAt: string;
  /** Who the spend belongs to; only editable on a shared ledger. */
  userId: string;
};

export interface DebtDraft {
  name: string;
  direction: DebtDirection;
  counterparty: string | null;
  principal: number;
  dueOn: string | null;
  note: string | null;
}

export interface RecurringDraft {
  kind: RecurringKind;
  label: string;
  amount: number;
  categoryId: string;
  accountId: string | null;
  dayOfMonth: number;
}

export interface AccountDraft {
  name: string;
  type: AccountType;
  openingBalance: number;
  color: string;
}

export interface BudgetDraft {
  categoryId: string | null;
  limitAmount: number;
}

// ── Derived summaries ───────────────────────────────────────────────────────

export interface Totals {
  /** Includes transaction costs — a fee is money gone. */
  spent: number;
  earned: number;
  /** `earned - spent`; negative means the month is running at a loss. */
  net: number;
  /** The share of `spent` that went on charges alone. */
  fees: number;
  count: number;
}

/** A debt with its outstanding balance worked out. */
export interface DebtView extends DebtRow {
  paid: number;
  balance: number;
  /** `paid / principal`, 0–1. */
  progress: number;
  ownerName: string;
  isSelf: boolean;
}

/** A salary or fixed bill, with its next posting date resolved. */
export interface RecurringView extends RecurringEntryRow {
  ownerName: string;
  isSelf: boolean;
  accountName: string | null;
  /** ISO date of the next time this will turn into a transaction. */
  nextPostOn: string;
  postedThisMonth: boolean;
}

/** What one person in the ledger is holding. */
export interface MemberBalance {
  member: Member;
  openingBalance: number;
  balance: number;
}

/** The household picture a couple sees: the total, plus who holds what. */
export interface CoupleBalance {
  total: number;
  openingTotal: number;
  perMember: MemberBalance[];
}

export interface CategorySummary {
  categoryId: string;
  label: string;
  color: string;
  total: number;
  /** Share of the period's spend, 0–1. */
  share: number;
  count: number;
}

export interface MemberSummary {
  member: Member;
  spent: number;
  earned: number;
  share: number;
  count: number;
}

export interface DayPoint {
  dayKey: string;
  spent: number;
  /** Running total for the month up to and including this day. */
  cumulative: number;
}

export interface MonthPoint {
  monthKey: string;
  spent: number;
  earned: number;
}

export type BudgetHealth = "ok" | "caution" | "over";

export interface BudgetStatus {
  budget: BudgetRow;
  categoryId: string | null;
  label: string;
  color: string;
  limit: number;
  spent: number;
  remaining: number;
  /** `spent / limit`, uncapped so the UI can say "112%". */
  ratio: number;
  health: BudgetHealth;
  /** Spend per remaining day that would land exactly on the limit. */
  dailyAllowance: number;
}

/** Everything the dashboard renders, computed in one pass. */
export interface MonthOverview {
  monthKey: string;
  totals: Totals;
  previousSpent: number;
  /** Change against last month as a ratio, or `null` with no history. */
  changeRatio: number | null;
  categories: CategorySummary[];
  members: MemberSummary[];
  days: DayPoint[];
  /** Spend extrapolated to the end of the month at the current pace. */
  projectedSpend: number;
  topBudget: BudgetStatus | null;
}
