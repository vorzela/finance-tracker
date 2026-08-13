/**
 * lib/api.ts
 *
 * Every Supabase read and write, as plain async functions plus the React Query
 * keys that cache them. Deliberately hook-free so both `lib/scope.tsx` and
 * `lib/queries.ts` can use it without an import cycle.
 *
 * Rows are fetched a month at a time. That keeps payloads small, and since the
 * dashboard, activity list and insights all look at the same month, they share
 * one cache entry.
 */

import { supabase } from "@/lib/supabase";
import { addMonths, currentMonthKey, monthRange } from "@/lib/date";
import {
  scopeGroupId,
  scopeKey,
  type Account,
  type AccountDraft,
  type BudgetDraft,
  type DebtDraft,
  type GroupSummary,
  type Member,
  type RecurringDraft,
  type Scope,
  type TransactionDraft,
} from "@/types/finance";
import type {
  AccountRow,
  BudgetRow,
  DebtRow,
  GroupRow,
  MemberRole,
  ProfileRow,
  RecurringEntryRow,
  TransactionRow,
} from "@/types/database";

// ── Query keys ──────────────────────────────────────────────────────────────

export const keys = {
  profile: (userId: string) => ["profile", userId] as const,
  groups: (userId: string) => ["groups", userId] as const,
  members: (scope: Scope) => ["members", scopeKey(scope)] as const,
  accounts: (scope: Scope) => ["accounts", scopeKey(scope)] as const,
  balances: (scope: Scope) => ["balances", scopeKey(scope)] as const,
  memberBalances: (scope: Scope) => ["member-balances", scopeKey(scope)] as const,
  budgets: (scope: Scope) => ["budgets", scopeKey(scope)] as const,
  debts: (scope: Scope) => ["debts", scopeKey(scope)] as const,
  debtBalances: (scope: Scope) => ["debt-balances", scopeKey(scope)] as const,
  recurring: (scope: Scope) => ["recurring", scopeKey(scope)] as const,
  transactions: (scope: Scope, monthKey: string) =>
    ["transactions", scopeKey(scope), monthKey] as const,
  history: (scope: Scope, monthKey: string, months: number) =>
    ["history", scopeKey(scope), monthKey, months] as const,
  /** Prefix used to invalidate everything belonging to one ledger. */
  scopeRoot: (scope: Scope) => scopeKey(scope),
};

/** Everything that changes when a transaction is written. */
export function scopeCaches(scope: Scope): (readonly unknown[])[] {
  const key = scopeKey(scope);
  return [
    ["transactions", key],
    ["history", key],
    ["balances", key],
    ["member-balances", key],
    // A transaction can be a debt repayment, which moves its balance.
    ["debt-balances", key],
  ];
}

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * Supabase surfaces policy failures as a generic error; translate the ones a
 * user can actually act on.
 */
function fail(error: { message: string; code?: string }, action: string): never {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("duplicate key")) {
    throw new Error("That already exists.");
  }
  if (error.code === "42501" || message.includes("row-level security")) {
    throw new Error("You don't have access to that ledger any more.");
  }
  if (message.toLowerCase().includes("network request failed")) {
    throw new Error("No connection. Your change wasn't saved.");
  }
  if (message.includes("does not exist") || message.includes("schema cache")) {
    throw new Error(
      "The database isn't set up yet — run supabase/schema.sql in the SQL editor.",
    );
  }
  throw new Error(message || `Couldn't ${action}.`);
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) fail(error, "load your profile");

  // The sign-up trigger normally creates this; self-heal if it didn't.
  if (!data) {
    const { data: created, error: insertError } = await supabase()
      .from("profiles")
      .insert({ id: userId, display_name: "Me" })
      .select("*")
      .single();
    if (insertError) fail(insertError, "create your profile");
    return created;
  }

  return data;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, "display_name" | "color" | "currency_code" | "avatar_url">>,
): Promise<ProfileRow> {
  const { data, error } = await supabase()
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) fail(error, "save your profile");
  return data;
}

/** Uploads a local image to the public `avatars` bucket and returns its URL. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = (localUri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase().storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: blob.type || `image/${ext}`,
  });
  if (error) fail(error, "upload your photo");

  const { data } = supabase().storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ── Groups ──────────────────────────────────────────────────────────────────

interface MembershipWithGroup {
  role: MemberRole;
  group: GroupRow | null;
}

export async function fetchGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase()
    .from("group_members")
    .select("role, group:groups(*)")
    .order("joined_at", { ascending: true });

  if (error) fail(error, "load your groups");

  const memberships = (data ?? []) as unknown as MembershipWithGroup[];
  const groups = memberships.filter((row) => row.group !== null);
  if (groups.length === 0) return [];

  // A second round trip is cheaper than an aggregate here, and policies already
  // limit the rows to groups the caller belongs to.
  const { data: counts, error: countError } = await supabase()
    .from("group_members")
    .select("group_id")
    .in(
      "group_id",
      groups.map((row) => row.group!.id),
    );

  if (countError) fail(countError, "count group members");

  const tally = new Map<string, number>();
  for (const row of counts ?? []) {
    tally.set(row.group_id, (tally.get(row.group_id) ?? 0) + 1);
  }

  return groups.map((row) => ({
    ...row.group!,
    role: row.role,
    memberCount: tally.get(row.group!.id) ?? 1,
  }));
}

export async function createGroup(name: string, currencyCode: string): Promise<GroupRow> {
  const { data, error } = await supabase().rpc("create_group", {
    p_name: name,
    p_currency: currencyCode,
  });

  if (error) fail(error, "create the group");
  return data as GroupRow;
}

export async function joinGroup(code: string): Promise<GroupRow> {
  const { data, error } = await supabase().rpc("join_group", {
    p_code: code.trim().toUpperCase(),
  });

  if (error) fail(error, "join the group");
  return data as GroupRow;
}

export async function rotateInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase().rpc("rotate_invite_code", {
    p_group_id: groupId,
  });

  if (error) fail(error, "change the invite code");
  return data as string;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase()
    .from("groups")
    .update({ name: name.trim() })
    .eq("id", groupId);

  if (error) fail(error, "rename the group");
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase()
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) fail(error, "leave the group");
}

// ── Members ─────────────────────────────────────────────────────────────────

interface MemberWithProfile {
  role: MemberRole;
  user_id: string;
  profile: Pick<ProfileRow, "id" | "display_name" | "color" | "avatar_url"> | null;
}

/** On a personal ledger there is exactly one member: you. */
export async function fetchMembers(scope: Scope, userId: string): Promise<Member[]> {
  if (scope.kind === "personal") {
    const profile = await fetchProfile(userId);
    return [
      {
        id: profile.id,
        name: profile.display_name,
        color: profile.color,
        role: "owner",
        isSelf: true,
        avatarUrl: profile.avatar_url,
      },
    ];
  }

  const { data, error } = await supabase()
    .from("group_members")
    .select("role, user_id, profile:profiles(id, display_name, color, avatar_url)")
    .eq("group_id", scope.groupId)
    .order("joined_at", { ascending: true });

  if (error) fail(error, "load the members");

  return ((data ?? []) as unknown as MemberWithProfile[]).map((row) => ({
    id: row.user_id,
    name: row.profile?.display_name ?? "Member",
    color: row.profile?.color ?? "#6b7280",
    role: row.role,
    isSelf: row.user_id === userId,
    avatarUrl: row.profile?.avatar_url ?? null,
  }));
}

// ── Accounts ────────────────────────────────────────────────────────────────

export async function fetchAccounts(scope: Scope): Promise<AccountRow[]> {
  const groupId = scopeGroupId(scope);
  const query = supabase()
    .from("accounts")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your accounts");
  return data ?? [];
}

export async function fetchBalances(scope: Scope): Promise<Record<string, number>> {
  const { data, error } = await supabase().rpc("account_balances", {
    p_group_id: scopeGroupId(scope),
  });

  if (error) fail(error, "work out your balances");

  const balances: Record<string, number> = {};
  for (const row of data ?? []) balances[row.account_id] = Number(row.balance);
  return balances;
}

/** What each person in the ledger is holding, for the household total. */
export async function fetchMemberBalances(
  scope: Scope,
): Promise<{ user_id: string; opening_balance: number; balance: number }[]> {
  const { data, error } = await supabase().rpc("member_balances", {
    p_group_id: scopeGroupId(scope),
  });

  if (error) fail(error, "work out your balances");
  return data ?? [];
}

/** Accounts with balances folded in, ready for the UI. */
export function withBalances(
  accounts: AccountRow[],
  balances: Record<string, number>,
): Account[] {
  return accounts.map((account) => ({
    ...account,
    balance: balances[account.id] ?? account.opening_balance,
  }));
}

export async function createAccount(
  scope: Scope,
  userId: string,
  draft: AccountDraft,
): Promise<void> {
  const { error } = await supabase()
    .from("accounts")
    .insert({
      owner_id: userId,
      group_id: scopeGroupId(scope),
      name: draft.name.trim(),
      type: draft.type,
      opening_balance: draft.openingBalance,
      color: draft.color,
    });

  if (error) fail(error, "add the account");
}

export async function updateAccount(
  id: string,
  draft: AccountDraft,
): Promise<void> {
  const { error } = await supabase()
    .from("accounts")
    .update({
      name: draft.name.trim(),
      type: draft.type,
      opening_balance: draft.openingBalance,
      color: draft.color,
    })
    .eq("id", id);

  if (error) fail(error, "save the account");
}

/**
 * Archives rather than deletes: transactions keep pointing at the account, so
 * removing it would silently rewrite history.
 */
export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase()
    .from("accounts")
    .update({ archived: true })
    .eq("id", id);

  if (error) fail(error, "remove the account");
}

// ── Transactions ────────────────────────────────────────────────────────────

export async function fetchTransactions(
  scope: Scope,
  monthKey: string,
): Promise<TransactionRow[]> {
  const { from, until } = monthRange(monthKey);
  const groupId = scopeGroupId(scope);

  const query = supabase()
    .from("transactions")
    .select("*")
    .gte("occurred_at", from)
    .lt("occurred_at", until)
    .order("occurred_at", { ascending: false });

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your transactions");
  return data ?? [];
}

export interface HistoryPoint {
  occurred_at: string;
  kind: TransactionRow["kind"];
  amount: number;
  fee_amount: number;
  category_id: string;
  user_id: string;
}

/** Trimmed rows over a window of months, for the trend chart. */
export async function fetchHistory(
  scope: Scope,
  monthKey: string,
  months: number,
): Promise<HistoryPoint[]> {
  const { from } = monthRange(addMonths(monthKey, -(months - 1)));
  const { until } = monthRange(monthKey);
  const groupId = scopeGroupId(scope);

  const query = supabase()
    .from("transactions")
    .select("occurred_at, kind, amount, fee_amount, category_id, user_id")
    .gte("occurred_at", from)
    .lt("occurred_at", until);

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your history");
  return (data ?? []) as HistoryPoint[];
}

export async function fetchTransaction(id: string): Promise<TransactionRow | null> {
  const { data, error } = await supabase()
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error, "load that transaction");
  return data;
}

export async function createTransaction(
  scope: Scope,
  draft: TransactionDraft,
): Promise<void> {
  const { error } = await supabase()
    .from("transactions")
    .insert({
      user_id: draft.userId,
      group_id: scopeGroupId(scope),
      kind: draft.kind,
      amount: draft.amount,
      fee_amount: draft.feeAmount,
      category_id: draft.categoryId,
      account_id: draft.accountId,
      to_account_id: draft.kind === "transfer" ? draft.toAccountId : null,
      debt_id: draft.debtId,
      note: draft.note?.trim() || null,
      occurred_at: draft.occurredAt,
    });

  if (error) fail(error, "save the transaction");
}

export async function updateTransaction(
  id: string,
  draft: TransactionDraft,
): Promise<void> {
  const { error } = await supabase()
    .from("transactions")
    .update({
      user_id: draft.userId,
      kind: draft.kind,
      amount: draft.amount,
      fee_amount: draft.feeAmount,
      category_id: draft.categoryId,
      account_id: draft.accountId,
      to_account_id: draft.kind === "transfer" ? draft.toAccountId : null,
      debt_id: draft.debtId,
      note: draft.note?.trim() || null,
      occurred_at: draft.occurredAt,
    })
    .eq("id", id);

  if (error) fail(error, "save the transaction");
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase().from("transactions").delete().eq("id", id);
  if (error) fail(error, "delete the transaction");
}

// ── Budgets ─────────────────────────────────────────────────────────────────

export async function fetchBudgets(scope: Scope): Promise<BudgetRow[]> {
  const groupId = scopeGroupId(scope);
  const query = supabase().from("budgets").select("*");

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your budgets");
  return data ?? [];
}

/**
 * One budget per category per ledger, so an existing row is updated in place
 * rather than a second one being created.
 */
export async function saveBudget(
  scope: Scope,
  userId: string,
  existing: BudgetRow | null,
  draft: BudgetDraft,
): Promise<void> {
  if (existing) {
    const { error } = await supabase()
      .from("budgets")
      .update({ limit_amount: draft.limitAmount })
      .eq("id", existing.id);
    if (error) fail(error, "save the budget");
    return;
  }

  const { error } = await supabase().from("budgets").insert({
    user_id: userId,
    group_id: scopeGroupId(scope),
    category_id: draft.categoryId,
    limit_amount: draft.limitAmount,
    month: null,
  });

  if (error) fail(error, "save the budget");
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase().from("budgets").delete().eq("id", id);
  if (error) fail(error, "remove the budget");
}

// ── Debts ───────────────────────────────────────────────────────────────────

export async function fetchDebts(scope: Scope): Promise<DebtRow[]> {
  const groupId = scopeGroupId(scope);
  const query = supabase()
    .from("debts")
    .select("*")
    .order("closed", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your debts");
  return data ?? [];
}

export async function fetchDebtBalances(scope: Scope): Promise<Map<string, DebtProgress>> {
  const { data, error } = await supabase().rpc("debt_balances", {
    p_group_id: scopeGroupId(scope),
  });

  if (error) fail(error, "work out what is left on your debts");
  return new Map(
    (data ?? []).map((row) => [row.debt_id, { paid: row.paid, balance: row.balance }]),
  );
}

export interface DebtProgress {
  paid: number;
  balance: number;
}

export async function createDebt(
  scope: Scope,
  userId: string,
  draft: DebtDraft,
): Promise<void> {
  const { error } = await supabase().from("debts").insert({
    user_id: userId,
    group_id: scopeGroupId(scope),
    name: draft.name.trim(),
    direction: draft.direction,
    counterparty: draft.counterparty?.trim() || null,
    principal: draft.principal,
    due_on: draft.dueOn,
    note: draft.note?.trim() || null,
  });

  if (error) fail(error, "add the debt");
}

export async function updateDebt(id: string, draft: DebtDraft): Promise<void> {
  const { error } = await supabase()
    .from("debts")
    .update({
      name: draft.name.trim(),
      direction: draft.direction,
      counterparty: draft.counterparty?.trim() || null,
      principal: draft.principal,
      due_on: draft.dueOn,
      note: draft.note?.trim() || null,
    })
    .eq("id", id);

  if (error) fail(error, "save the debt");
}

export async function setDebtClosed(id: string, closed: boolean): Promise<void> {
  const { error } = await supabase().from("debts").update({ closed }).eq("id", id);
  if (error) fail(error, "update the debt");
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase().from("debts").delete().eq("id", id);
  if (error) fail(error, "remove the debt");
}

// ── Recurring entries (salary, fixed bills) ─────────────────────────────────

export async function fetchRecurring(scope: Scope): Promise<RecurringEntryRow[]> {
  const groupId = scopeGroupId(scope);
  const query = supabase()
    .from("recurring_entries")
    .select("*")
    .order("day_of_month", { ascending: true });

  const { data, error } = await (groupId
    ? query.eq("group_id", groupId)
    : query.is("group_id", null));

  if (error) fail(error, "load your monthly income and bills");
  return data ?? [];
}

/**
 * An entry whose day has already passed this month starts next month, so
 * adding "salary on the 5th" on the 20th does not immediately invent a salary
 * that was probably already recorded by hand.
 */
export async function createRecurring(
  scope: Scope,
  userId: string,
  draft: RecurringDraft,
): Promise<void> {
  const today = new Date();
  const alreadyPassed = draft.dayOfMonth <= today.getDate();

  const { error } = await supabase().from("recurring_entries").insert({
    user_id: userId,
    group_id: scopeGroupId(scope),
    kind: draft.kind,
    label: draft.label.trim(),
    amount: draft.amount,
    category_id: draft.categoryId,
    account_id: draft.accountId,
    day_of_month: draft.dayOfMonth,
    last_posted_month: alreadyPassed ? currentMonthKey() : null,
  });

  if (error) fail(error, "save the monthly entry");
}

export async function updateRecurring(
  id: string,
  draft: RecurringDraft,
): Promise<void> {
  const { error } = await supabase()
    .from("recurring_entries")
    .update({
      kind: draft.kind,
      label: draft.label.trim(),
      amount: draft.amount,
      category_id: draft.categoryId,
      account_id: draft.accountId,
      day_of_month: draft.dayOfMonth,
    })
    .eq("id", id);

  if (error) fail(error, "save the monthly entry");
}

export async function setRecurringActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase()
    .from("recurring_entries")
    .update({ active })
    .eq("id", id);

  if (error) fail(error, "update the monthly entry");
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase().from("recurring_entries").delete().eq("id", id);
  if (error) fail(error, "remove the monthly entry");
}

/**
 * Posts any salary or bill that has come due. Safe to call on every app open:
 * the database only posts each entry once per month.
 */
export async function postDueRecurring(): Promise<number> {
  const { data, error } = await supabase().rpc("post_due_recurring");
  if (error) fail(error, "post your monthly income and bills");
  return data ?? 0;
}
