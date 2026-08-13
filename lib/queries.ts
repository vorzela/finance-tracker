/**
 * lib/queries.ts
 *
 * React Query bindings over `lib/api.ts`. Screens only ever talk to this file,
 * so cache invalidation lives in one place.
 *
 * Everything is keyed by the active scope, which means switching between the
 * personal and shared ledger swaps datasets without any manual clearing.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import * as api from "@/lib/api";
import { keys } from "@/lib/api";
import { buildOverview, coupleBalance, nextPostDate } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { currentMonthKey, monthKeyOf } from "@/lib/date";
import { useScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { scopeGroupId, scopeKey, type Scope } from "@/types/finance";
import type {
  Account,
  AccountDraft,
  BudgetDraft,
  CoupleBalance,
  DebtDraft,
  DebtView,
  Member,
  MonthOverview,
  RecurringDraft,
  RecurringView,
  TransactionDraft,
  TransactionView,
} from "@/types/finance";
import type { BudgetRow, ProfileRow, TransactionRow } from "@/types/database";

const MONTHS_OF_HISTORY = 6;

// ── Profile ─────────────────────────────────────────────────────────────────

export function useProfile() {
  const { user, status } = useAuth();

  return useQuery({
    queryKey: keys.profile(user?.id ?? "anonymous"),
    queryFn: () => api.fetchProfile(user!.id),
    enabled: status === "signedIn" && Boolean(user),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile(): UseMutationResult<
  ProfileRow,
  Error,
  Partial<Pick<ProfileRow, "display_name" | "color" | "currency_code" | "avatar_url">>
> {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch) => api.updateProfile(user!.id, patch),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.profile(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useUploadAvatar() {
  const { user } = useAuth();
  const update = useUpdateProfile();

  return useMutation({
    mutationFn: async (localUri: string) => {
      const url = await api.uploadAvatar(user!.id, localUri);
      await update.mutateAsync({ avatar_url: url });
      return url;
    },
  });
}

/**
 * The currency to render amounts in: a shared ledger uses the group's currency
 * so both people see the same thing, otherwise your own preference.
 */
export function useCurrency(): string {
  const { data: profile } = useProfile();
  const { activeGroup, scope } = useScope();

  if (scope.kind === "group" && activeGroup) return activeGroup.currency_code;
  return profile?.currency_code ?? DEFAULT_CURRENCY;
}

// ── Members ─────────────────────────────────────────────────────────────────

export function useMembers() {
  const { user, status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.members(scope),
    queryFn: () => api.fetchMembers(scope, user!.id),
    enabled: status === "signedIn" && Boolean(user),
    staleTime: 60_000,
  });
}

// ── Accounts ────────────────────────────────────────────────────────────────

export function useAccounts() {
  const { status } = useAuth();
  const { scope } = useScope();

  const accountsQuery = useQuery({
    queryKey: keys.accounts(scope),
    queryFn: () => api.fetchAccounts(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });

  const balancesQuery = useQuery({
    queryKey: keys.balances(scope),
    queryFn: () => api.fetchBalances(scope),
    enabled: status === "signedIn",
    staleTime: 30_000,
  });

  const accounts = useMemo<Account[]>(
    () => api.withBalances(accountsQuery.data ?? [], balancesQuery.data ?? {}),
    [accountsQuery.data, balancesQuery.data],
  );

  return {
    accounts,
    isLoading: accountsQuery.isLoading,
    isError: accountsQuery.isError,
    error: accountsQuery.error,
    refetch: accountsQuery.refetch,
  };
}

export function useSaveAccount() {
  const { user } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: AccountDraft }) =>
      id ? api.updateAccount(id, draft) : api.createAccount(scope, user!.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.accounts(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.balances(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.memberBalances(scope) });
    },
  });
}

export function useArchiveAccount() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.archiveAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.accounts(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.balances(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.memberBalances(scope) });
    },
  });
}

// ── Transactions ────────────────────────────────────────────────────────────

export function useTransactions(monthKey: string) {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.transactions(scope, monthKey),
    queryFn: () => api.fetchTransactions(scope, monthKey),
    enabled: status === "signedIn",
    staleTime: 15_000,
  });
}

/**
 * A single transaction for the edit screen. Seeded from whichever month is
 * already cached so the form paints immediately, then confirmed against the
 * database in case the other phone changed it.
 */
export function useTransaction(id: string | undefined) {
  const { status } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["transaction", id ?? "new"],
    queryFn: () => api.fetchTransaction(id!),
    enabled: status === "signedIn" && Boolean(id),
    initialData: () => {
      if (!id) return undefined;
      const cached = queryClient.getQueriesData<TransactionRow[]>({
        queryKey: ["transactions", scopeKey(scope)],
      });
      for (const [, rows] of cached) {
        const match = rows?.find((row) => row.id === id);
        if (match) return match;
      }
      return undefined;
    },
  });
}

export function useHistory(monthKey: string, months = MONTHS_OF_HISTORY) {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.history(scope, monthKey, months),
    queryFn: () => api.fetchHistory(scope, monthKey, months),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });
}

/** Adds the labels a list row needs, resolved from the members and accounts. */
export function useTransactionViews(rows: TransactionRow[]): TransactionView[] {
  const { data: members } = useMembers();
  const { accounts } = useAccounts();
  const { data: debts } = useDebtRows();

  return useMemo(() => {
    const memberById = new Map((members ?? []).map((member) => [member.id, member]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const debtById = new Map((debts ?? []).map((debt) => [debt.id, debt]));

    return rows.map((row) => {
      const member = memberById.get(row.user_id);
      return {
        ...row,
        memberName: member?.name ?? "Someone",
        memberLabel: member?.isSelf ? "You" : (member?.name ?? "Someone"),
        memberColor: member?.color ?? "#6b7280",
        isSelf: member?.isSelf ?? false,
        accountName: row.account_id
          ? (accountById.get(row.account_id)?.name ?? null)
          : null,
        toAccountName: row.to_account_id
          ? (accountById.get(row.to_account_id)?.name ?? null)
          : null,
        totalAmount: row.amount + row.fee_amount,
        debtName: row.debt_id ? (debtById.get(row.debt_id)?.name ?? null) : null,
      };
    });
  }, [rows, members, accounts, debts]);
}

function useInvalidateLedger() {
  const queryClient = useQueryClient();
  const { scope } = useScope();

  return () => {
    for (const key of api.scopeCaches(scope)) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useSaveTransaction() {
  const { scope } = useScope();
  const invalidate = useInvalidateLedger();

  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: TransactionDraft }) =>
      id ? api.updateTransaction(id, draft) : api.createTransaction(scope, draft),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateLedger();

  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: invalidate,
  });
}

// ── Budgets ─────────────────────────────────────────────────────────────────

export function useBudgets() {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.budgets(scope),
    queryFn: () => api.fetchBudgets(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });
}

export function useSaveBudget() {
  const { user } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      existing,
      draft,
    }: {
      existing: BudgetRow | null;
      draft: BudgetDraft;
    }) => api.saveBudget(scope, user!.id, existing, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.budgets(scope) });
    },
  });
}

export function useDeleteBudget() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteBudget(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.budgets(scope) });
    },
  });
}

// ── Household balances ──────────────────────────────────────────────────────

/**
 * What the household is worth: one total, plus who is holding what. On a
 * personal ledger there is only ever one member, so this collapses to your own
 * balance.
 */
export function useCoupleBalance(): {
  data: CoupleBalance | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { status } = useAuth();
  const { scope } = useScope();
  const members = useMembers();

  const query = useQuery({
    queryKey: keys.memberBalances(scope),
    queryFn: () => api.fetchMemberBalances(scope),
    enabled: status === "signedIn",
    staleTime: 30_000,
  });

  const data = useMemo(() => {
    if (!query.data) return null;
    return coupleBalance(query.data, members.data ?? []);
  }, [query.data, members.data]);

  return {
    data,
    isLoading: query.isLoading || members.isLoading,
    refetch: () => {
      void query.refetch();
    },
  };
}

// ── Debts ───────────────────────────────────────────────────────────────────

/** Raw rows, used where only the names are needed. */
function useDebtRows() {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.debts(scope),
    queryFn: () => api.fetchDebts(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });
}

export function useDebts(): {
  debts: DebtView[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { status } = useAuth();
  const { scope } = useScope();
  const members = useMembers();
  const rows = useDebtRows();

  const balances = useQuery({
    queryKey: keys.debtBalances(scope),
    queryFn: () => api.fetchDebtBalances(scope),
    enabled: status === "signedIn",
    staleTime: 30_000,
  });

  const debts = useMemo<DebtView[]>(() => {
    const memberById = new Map((members.data ?? []).map((m) => [m.id, m]));

    return (rows.data ?? []).map((debt) => {
      const progress = balances.data?.get(debt.id);
      const paid = progress?.paid ?? 0;
      const owner = memberById.get(debt.user_id);

      return {
        ...debt,
        paid,
        balance: progress?.balance ?? debt.principal,
        progress: debt.principal === 0 ? 0 : Math.min(paid / debt.principal, 1),
        ownerName: owner?.isSelf ? "You" : (owner?.name ?? "Someone"),
        isSelf: owner?.isSelf ?? false,
      };
    });
  }, [rows.data, balances.data, members.data]);

  return {
    debts,
    isLoading: rows.isLoading,
    error: (rows.error ?? balances.error) as Error | null,
    refetch: () => {
      void rows.refetch();
      void balances.refetch();
    },
  };
}

export function useSaveDebt() {
  const { user } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: DebtDraft }) =>
      id ? api.updateDebt(id, draft) : api.createDebt(scope, user!.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.debts(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.debtBalances(scope) });
    },
  });
}

export function useSetDebtClosed() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, closed }: { id: string; closed: boolean }) =>
      api.setDebtClosed(id, closed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.debts(scope) });
    },
  });
}

export function useDeleteDebt() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteDebt(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.debts(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.debtBalances(scope) });
    },
  });
}

// ── Monthly income and bills ────────────────────────────────────────────────

export function useRecurring(): {
  entries: RecurringView[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { status } = useAuth();
  const { scope } = useScope();
  const members = useMembers();
  const { accounts } = useAccounts();

  const query = useQuery({
    queryKey: keys.recurring(scope),
    queryFn: () => api.fetchRecurring(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });

  const entries = useMemo<RecurringView[]>(() => {
    const memberById = new Map((members.data ?? []).map((m) => [m.id, m]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const thisMonth = currentMonthKey();

    return (query.data ?? []).map((entry) => {
      const owner = memberById.get(entry.user_id);
      return {
        ...entry,
        ownerName: owner?.isSelf ? "You" : (owner?.name ?? "Someone"),
        isSelf: owner?.isSelf ?? false,
        accountName: entry.account_id
          ? (accountById.get(entry.account_id)?.name ?? null)
          : null,
        nextPostOn: nextPostDate(entry),
        postedThisMonth: entry.last_posted_month === thisMonth,
      };
    });
  }, [query.data, members.data, accounts]);

  return {
    entries,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useSaveRecurring() {
  const { user } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id?: string; draft: RecurringDraft }) =>
      id ? api.updateRecurring(id, draft) : api.createRecurring(scope, user!.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.recurring(scope) });
    },
  });
}

export function useSetRecurringActive() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.setRecurringActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.recurring(scope) });
    },
  });
}

export function useDeleteRecurring() {
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteRecurring(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.recurring(scope) });
    },
  });
}

/**
 * Posts any salary or bill that has fallen due, once per app launch. The
 * database guarantees an entry can only post once a month, so the worst a
 * repeat call can do is nothing.
 */
export function usePostDueRecurring(): void {
  const { status } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "signedIn") return;

    let cancelled = false;
    void api
      .postDueRecurring()
      .then((posted) => {
        if (cancelled || posted === 0) return;
        for (const key of api.scopeCaches(scope)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
        void queryClient.invalidateQueries({ queryKey: keys.recurring(scope) });
      })
      // A failure here is not worth interrupting the user for: the entries
      // will post on the next launch.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status, scope, queryClient]);
}

// ── Groups ──────────────────────────────────────────────────────────────────

export function useCreateGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setScope } = useScope();

  return useMutation({
    mutationFn: ({ name, currencyCode }: { name: string; currencyCode: string }) =>
      api.createGroup(name, currencyCode),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: keys.groups(user!.id) });
      setScope({ kind: "group", groupId: group.id });
    },
  });
}

export function useJoinGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setScope } = useScope();

  return useMutation({
    mutationFn: (code: string) => api.joinGroup(code),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: keys.groups(user!.id) });
      setScope({ kind: "group", groupId: group.id });
    },
  });
}

export function useRotateInviteCode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => api.rotateInviteCode(groupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.groups(user!.id) });
    },
  });
}

export function useRenameGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      api.renameGroup(groupId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.groups(user!.id) });
    },
  });
}

export function useLeaveGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { setScope } = useScope();

  return useMutation({
    mutationFn: (groupId: string) => api.leaveGroup(groupId, user!.id),
    onSuccess: async () => {
      setScope({ kind: "personal" });
      await queryClient.invalidateQueries({ queryKey: keys.groups(user!.id) });
    },
  });
}

// ── Composite: the dashboard ─────────────────────────────────────────────────

export interface OverviewResult {
  overview: MonthOverview | null;
  members: Member[];
  rows: TransactionRow[];
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useMonthOverview(monthKey: string): OverviewResult {
  const transactions = useTransactions(monthKey);
  const history = useHistory(monthKey);
  const budgets = useBudgets();
  const members = useMembers();

  const previousMonthRows = useMemo(() => {
    const previous = previousMonthOf(monthKey);
    return (history.data ?? []).filter(
      (point) => monthKeyOf(point.occurred_at) === previous,
    );
  }, [history.data, monthKey]);

  const overview = useMemo(() => {
    if (!transactions.data) return null;
    return buildOverview({
      monthKey,
      rows: transactions.data,
      previousRows: previousMonthRows,
      members: members.data ?? [],
      budgets: budgets.data ?? [],
    });
  }, [transactions.data, previousMonthRows, members.data, budgets.data, monthKey]);

  return {
    overview,
    members: members.data ?? [],
    rows: transactions.data ?? [],
    isLoading: transactions.isLoading || members.isLoading,
    isRefetching: transactions.isRefetching || history.isRefetching,
    error: (transactions.error ?? members.error ?? budgets.error) as Error | null,
    refetch: () => {
      void transactions.refetch();
      void history.refetch();
      void budgets.refetch();
      void members.refetch();
    },
  };
}

function previousMonthOf(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ── Realtime ────────────────────────────────────────────────────────────────

/**
 * Keeps a shared ledger live: when one phone writes a transaction, the other
 * refetches instead of waiting for a pull-to-refresh.
 *
 * Only shared ledgers are subscribed — a personal ledger has one writer, and
 * that writer already invalidates its own caches.
 */
export function useLedgerRealtime(): void {
  const { scope } = useScope();
  const { status } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const groupId = scopeGroupId(scope);
    if (status !== "signedIn" || !groupId) return;

    const channel = supabase()
      .channel(`ledger:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          for (const key of api.scopeCaches(scope)) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase().removeChannel(channel);
    };
  }, [scope, status, queryClient]);
}

/** Convenience for screens that always want the current month. */
export function useThisMonth(): string {
  return useMemo(() => currentMonthKey(), []);
}

export type { Scope };
