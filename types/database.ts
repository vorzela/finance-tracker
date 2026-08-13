/**
 * types/database.ts
 *
 * Hand-written mirror of `supabase/schema.sql`. Keeping it by hand rather than
 * generating it means the app has no dependency on the Supabase CLI, but it
 * does mean this file has to be edited whenever the SQL changes.
 *
 * Every money column is a bigint of minor units (cents) — see `lib/currency.ts`.
 *
 * The row shapes have to be `type` aliases, not interfaces: supabase-js checks
 * `Database['public'] extends GenericSchema`, which needs each row to satisfy
 * `Record<string, unknown>`, and only aliases get an implicit index signature.
 * An interface here silently degrades every table type to `never`.
 */

export type TransactionKind = "expense" | "income" | "transfer";
export type AccountType = "cash" | "bank" | "mobile" | "card";
export type MemberRole = "owner" | "member";
export type DebtDirection = "owed_by_me" | "owed_to_me";
export type RecurringKind = "income" | "expense";

export type ProfileRow = {
  id: string;
  display_name: string;
  color: string;
  currency_code: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupRow = {
  id: string;
  name: string;
  currency_code: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
};

export type AccountRow = {
  id: string;
  owner_id: string;
  /** `null` for a personal account. */
  group_id: string | null;
  name: string;
  type: AccountType;
  opening_balance: number;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  /** Whose spend this is, which drives the per-person split. */
  user_id: string;
  /** `null` for a personal transaction. */
  group_id: string | null;
  kind: TransactionKind;
  amount: number;
  /** The M-Pesa or bank charge. Counted as spending everywhere. */
  fee_amount: number;
  category_id: string;
  account_id: string | null;
  to_account_id: string | null;
  /** Set when this transaction pays down a debt. */
  debt_id: string | null;
  note: string | null;
  /** ISO timestamp — the date *and* time it happened. */
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type DebtRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  name: string;
  direction: DebtDirection;
  counterparty: string | null;
  principal: number;
  /** `YYYY-MM-DD`. */
  due_on: string | null;
  note: string | null;
  closed: boolean;
  created_at: string;
  updated_at: string;
};

export type RecurringEntryRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  kind: RecurringKind;
  label: string;
  amount: number;
  category_id: string;
  account_id: string | null;
  day_of_month: number;
  active: boolean;
  /** `YYYY-MM` of the last month this posted, so it never posts twice. */
  last_posted_month: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  /** `null` means the ceiling covers every category. */
  category_id: string | null;
  limit_amount: number;
  /** `YYYY-MM` for a one-off month, `null` when it repeats monthly. */
  month: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns the database fills in, so callers never have to send them. */
type Generated = "id" | "created_at" | "updated_at";

type Insert<Row, Required extends keyof Row> = Partial<Omit<Row, Generated>> &
  Pick<Row, Required>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insert<ProfileRow, "id"> & { id: string };
        Update: Partial<Omit<ProfileRow, "id" | "created_at">>;
        Relationships: [];
      };
      groups: {
        Row: GroupRow;
        Insert: Insert<GroupRow, "name" | "invite_code" | "created_by">;
        Update: Partial<Omit<GroupRow, "id" | "created_at">>;
        Relationships: [];
      };
      group_members: {
        Row: GroupMemberRow;
        Insert: Omit<GroupMemberRow, "joined_at"> & { joined_at?: string };
        Update: Partial<GroupMemberRow>;
        Relationships: [];
      };
      accounts: {
        Row: AccountRow;
        Insert: Insert<AccountRow, "owner_id" | "name">;
        Update: Partial<Omit<AccountRow, "id" | "created_at">>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Insert<TransactionRow, "user_id" | "kind" | "amount">;
        Update: Partial<Omit<TransactionRow, "id" | "created_at">>;
        Relationships: [];
      };
      budgets: {
        Row: BudgetRow;
        Insert: Insert<BudgetRow, "user_id" | "limit_amount">;
        Update: Partial<Omit<BudgetRow, "id" | "created_at">>;
        Relationships: [];
      };
      debts: {
        Row: DebtRow;
        Insert: Insert<DebtRow, "user_id" | "name" | "principal">;
        Update: Partial<Omit<DebtRow, "id" | "created_at">>;
        Relationships: [];
      };
      recurring_entries: {
        Row: RecurringEntryRow;
        Insert: Insert<RecurringEntryRow, "user_id" | "kind" | "label" | "amount">;
        Update: Partial<Omit<RecurringEntryRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    // `{ [_ in never]: never }` rather than `Record<string, never>`: the client
    // intersects Tables with Views, and an index signature of `never` there
    // would collapse every table type to `never`.
    Views: { [_ in never]: never };
    Functions: {
      create_group: {
        Args: { p_name: string; p_currency?: string };
        Returns: GroupRow;
      };
      join_group: {
        Args: { p_code: string };
        Returns: GroupRow;
      };
      rotate_invite_code: {
        Args: { p_group_id: string };
        Returns: string;
      };
      account_balances: {
        Args: { p_group_id?: string | null };
        Returns: { account_id: string; balance: number }[];
      };
      member_balances: {
        Args: { p_group_id?: string | null };
        Returns: { user_id: string; opening_balance: number; balance: number }[];
      };
      debt_balances: {
        Args: { p_group_id?: string | null };
        Returns: { debt_id: string; paid: number; balance: number }[];
      };
      post_due_recurring: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
