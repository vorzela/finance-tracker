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
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import * as api from "@/lib/api";
import { HISTORY_MONTHS, keys, type LedgerHome } from "@/lib/api";
import {
  buildOverview,
  coupleBalance,
  fillMonthHistory,
  nextPostDate,
} from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { addMonths, currentMonthKey, monthKeyOf } from "@/lib/date";
import { enqueueOffline, isNetworkFailure } from "@/lib/offline-queue";
import { useScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { uuid } from "@/lib/uuid";
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
  MonthPoint,
  RecurringDraft,
  RecurringView,
  TransactionDraft,
  TransactionView,
} from "@/types/finance";
import type { BudgetRow, MessageRow, ProfileRow, TransactionRow } from "@/types/database";

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
  const profileQuery = useProfile();

  const groupQuery = useQuery({
    queryKey: keys.members(scope),
    queryFn: () => api.fetchMembers(scope, user!.id),
    enabled: status === "signedIn" && Boolean(user) && scope.kind === "group",
    staleTime: 60_000,
  });

  if (scope.kind === "personal") {
    const members = profileQuery.data
      ? [
          {
            id: profileQuery.data.id,
            name: profileQuery.data.display_name,
            color: profileQuery.data.color,
            role: "owner" as const,
            isSelf: true,
            avatarUrl: profileQuery.data.avatar_url,
          },
        ]
      : undefined;

    return {
      ...profileQuery,
      data: members,
    };
  }

  return groupQuery;
}

// ── Accounts ────────────────────────────────────────────────────────────────

export function useAccountRows() {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.accounts(scope),
    queryFn: () => api.fetchAccounts(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });
}

export function useAccounts() {
  const { status } = useAuth();
  const { scope } = useScope();

  const accountsQuery = useAccountRows();
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
    mutationFn: async ({ id, draft }: { id?: string; draft: AccountDraft }) => {
      const run = async (clientId?: string) => {
        if (id) await api.updateAccount(id, draft);
        else await api.createAccount(scope, user!.id, draft, clientId);
      };

      if (!onlineManager.isOnline()) {
        const clientId = id ? undefined : uuid();
        if (id) {
          await enqueueOffline({ type: "updateAccount", accountId: id, draft });
        } else {
          await enqueueOffline({
            type: "createAccount",
            scope,
            userId: user!.id,
            draft,
            clientId: clientId!,
          });
        }
        return { offline: true as const };
      }

      try {
        await run();
        return { offline: false as const };
      } catch (error) {
        if (!isNetworkFailure(error)) throw error;
        const clientId = id ? undefined : uuid();
        if (id) {
          await enqueueOffline({ type: "updateAccount", accountId: id, draft });
        } else {
          await enqueueOffline({
            type: "createAccount",
            scope,
            userId: user!.id,
            draft,
            clientId: clientId!,
          });
        }
        return { offline: true as const };
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.accounts(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.balances(scope) });
      void queryClient.invalidateQueries({ queryKey: keys.memberBalances(scope) });
      void queryClient.invalidateQueries({ queryKey: ["home", scopeKey(scope)] });
    },
    networkMode: "always",
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
      void queryClient.invalidateQueries({ queryKey: ["home", scopeKey(scope)] });
    },
  });
}

// ── Transactions ────────────────────────────────────────────────────────────

export function useTransactions(monthKey: string) {
  const snapshot = useLedgerSnapshot(monthKey);

  return {
    data: snapshot.data?.transactions,
    isLoading: snapshot.isPending,
    isFetching: snapshot.isFetching,
    isRefetching: snapshot.isRefetching,
    isError: snapshot.isError,
    error: snapshot.error,
    refetch: snapshot.refetch,
  };
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

export function useHistory(monthKey: string, months = HISTORY_MONTHS) {
  const snapshot = useLedgerSnapshot(monthKey);
  const data = useMemo(
    () => fillMonthHistory(snapshot.data?.history ?? [], monthKey, months),
    [snapshot.data?.history, monthKey, months],
  );

  return {
    data,
    isLoading: snapshot.isPending,
    isFetching: snapshot.isFetching,
    isRefetching: snapshot.isRefetching,
    isError: snapshot.isError,
    error: snapshot.error,
    refetch: snapshot.refetch,
  };
}

/** Adds the labels a list row needs, resolved from the members and accounts. */
export function useTransactionViews(rows: TransactionRow[]): TransactionView[] {
  const { data: members } = useMembers();
  const { data: accountRows } = useAccountRows();
  const needsDebts = useMemo(() => rows.some((row) => Boolean(row.debt_id)), [rows]);
  const { data: debts } = useDebtRows(needsDebts);

  return useMemo(() => {
    const memberById = new Map((members ?? []).map((member) => [member.id, member]));
    const accountById = new Map((accountRows ?? []).map((account) => [account.id, account]));
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
  }, [rows, members, accountRows, debts]);
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
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLedger();

  return useMutation({
    mutationFn: async ({ id, draft }: { id?: string; draft: TransactionDraft }) => {
      const runOnline = async (clientId?: string) => {
        if (id) await api.updateTransaction(id, draft);
        else await api.createTransaction(scope, draft, clientId);
      };

      const queue = async (clientId?: string) => {
        if (id) {
          await enqueueOffline({
            type: "updateTransaction",
            transactionId: id,
            draft,
          });
        } else {
          await enqueueOffline({
            type: "createTransaction",
            scope,
            draft,
            clientId: clientId!,
          });
        }
      };

      if (!onlineManager.isOnline()) {
        const clientId = id ?? uuid();
        await queue(id ? undefined : clientId);
        patchTransactionCache(queryClient, scope, id ?? clientId, draft);
        return { offline: true as const };
      }

      try {
        await runOnline();
        return { offline: false as const };
      } catch (error) {
        if (!isNetworkFailure(error)) throw error;
        const clientId = id ?? uuid();
        await queue(id ? undefined : clientId);
        patchTransactionCache(queryClient, scope, id ?? clientId, draft);
        return { offline: true as const };
      }
    },
    onSuccess: (result) => {
      if (!result?.offline) invalidate();
    },
    networkMode: "always",
  });
}

function patchTransactionCache(
  queryClient: QueryClient,
  scope: Scope,
  id: string,
  draft: TransactionDraft,
) {
  const monthKey = monthKeyOf(draft.occurredAt);
  const key = keys.transactions(scope, monthKey);
  const row: TransactionRow = {
    id,
    user_id: draft.userId,
    group_id: scopeGroupId(scope),
    kind: draft.kind,
    amount: draft.amount,
    fee_amount: draft.feeAmount,
    category_id: draft.categoryId,
    account_id: draft.accountId,
    to_account_id: draft.kind === "transfer" ? draft.toAccountId : null,
    debt_id: draft.debtId,
    note: draft.note,
    occurred_at: draft.occurredAt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  queryClient.setQueryData<TransactionRow[]>(key, (prev) => {
    const list = prev ?? [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      const next = [...list];
      next[index] = { ...next[index], ...row };
      return next;
    }
    return [row, ...list];
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateLedger();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!onlineManager.isOnline()) {
        await enqueueOffline({ type: "deleteTransaction", transactionId: id });
        return { offline: true as const };
      }
      try {
        await api.deleteTransaction(id);
        return { offline: false as const };
      } catch (error) {
        if (!isNetworkFailure(error)) throw error;
        await enqueueOffline({ type: "deleteTransaction", transactionId: id });
        return { offline: true as const };
      }
    },
    onSuccess: invalidate,
    networkMode: "always",
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
      void queryClient.invalidateQueries({ queryKey: ["home", scopeKey(scope)] });
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
      void queryClient.invalidateQueries({ queryKey: ["home", scopeKey(scope)] });
    },
  });
}

// ── Household balances ──────────────────────────────────────────────────────

/** Raw per-member totals from the member_balances RPC — see its SQL comment
 * for exactly what's attributed to whom and why. */
function useMemberBalanceRows() {
  const { scope } = useScope();
  return useQuery({
    queryKey: keys.memberBalances(scope),
    queryFn: () => api.fetchMemberBalances(scope),
    staleTime: 15_000,
  });
}

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
  const rows = useMemberBalanceRows();
  const members = useMembers();

  const data = useMemo(() => {
    if (!rows.data && !members.data) return null;
    return coupleBalance(rows.data ?? [], members.data ?? []);
  }, [rows.data, members.data]);

  return {
    data,
    isLoading: rows.isLoading || members.isLoading,
    refetch: () => {
      void rows.refetch();
    },
  };
}

// ── Debts ───────────────────────────────────────────────────────────────────

/** Raw rows, used where only the names are needed. */
function useDebtRows(enabled = true) {
  const { status } = useAuth();
  const { scope } = useScope();

  return useQuery({
    queryKey: keys.debts(scope),
    queryFn: () => api.fetchDebts(scope),
    enabled: status === "signedIn" && enabled,
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
  const { data: accountRows } = useAccountRows();

  const query = useQuery({
    queryKey: keys.recurring(scope),
    queryFn: () => api.fetchRecurring(scope),
    enabled: status === "signedIn",
    staleTime: 60_000,
  });

  const entries = useMemo<RecurringView[]>(() => {
    const memberById = new Map((members.data ?? []).map((m) => [m.id, m]));
    const accountById = new Map((accountRows ?? []).map((account) => [account.id, account]));
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
  }, [query.data, members.data, accountRows]);

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
  accounts: Account[];
  history: MonthPoint[];
  couple: CoupleBalance | null;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  refetch: () => void;
}

function hydrateLedgerCaches(
  queryClient: QueryClient,
  scope: Scope,
  monthKey: string,
  snap: LedgerHome,
) {
  queryClient.setQueryData(keys.transactions(scope, monthKey), snap.transactions);
  queryClient.setQueryData(keys.monthHistory(scope, monthKey, HISTORY_MONTHS), snap.history);
  queryClient.setQueryData(
    keys.accounts(scope),
    snap.accounts.map(({ balance: _balance, ...row }) => row),
  );
  const balances: Record<string, number> = {};
  for (const account of snap.accounts) balances[account.id] = account.balance;
  queryClient.setQueryData(keys.balances(scope), balances);
  queryClient.setQueryData(keys.budgets(scope), snap.budgets);
  queryClient.setQueryData(keys.members(scope), snap.members);
}

/**
 * One round trip for the month the UI is looking at. Activity, insights and
 * budget alerts subscribe to the same query, so the tab bar does not fan out
 * a dozen independent Supabase calls on launch.
 */
export function useLedgerSnapshot(monthKey: string) {
  const { user, status } = useAuth();
  const { scope } = useScope();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: keys.home(scope, monthKey),
    queryFn: async () => {
      const snap = await api.fetchLedgerHome(scope, user!.id, monthKey);
      hydrateLedgerCaches(queryClient, scope, monthKey, snap);
      return snap;
    },
    enabled: status === "signedIn" && Boolean(user),
    staleTime: 15_000,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) return undefined;
      if (previousQuery.queryKey[1] !== scopeKey(scope)) return undefined;
      return previousData;
    },
  });
}

export function useMonthOverview(monthKey: string): OverviewResult {
  const snapshot = useLedgerSnapshot(monthKey);
  // Member balances are all-time (seed money + everything ever logged), not
  // scoped to this month, so they can't be derived from snapshot.data — that
  // only carries this month's transactions. Fetched separately; React Query
  // dedupes this against useCoupleBalance() when both are mounted at once.
  const memberRows = useMemberBalanceRows();

  const overview = useMemo(() => {
    if (!snapshot.data) return null;
    const previousSpent =
      snapshot.data.history.find((point) => point.monthKey === addMonths(monthKey, -1))
        ?.spent ?? 0;
    return buildOverview({
      monthKey,
      rows: snapshot.data.transactions,
      previousSpent,
      members: snapshot.data.members,
      budgets: snapshot.data.budgets,
    });
  }, [snapshot.data, monthKey]);

  const couple = useMemo(() => {
    if (!snapshot.data) return null;
    return coupleBalance(memberRows.data ?? [], snapshot.data.members);
  }, [snapshot.data, memberRows.data]);

  return {
    overview,
    members: snapshot.data?.members ?? [],
    rows: snapshot.data?.transactions ?? [],
    accounts: snapshot.data?.accounts ?? [],
    history: snapshot.data?.history ?? [],
    couple,
    isLoading: snapshot.isPending,
    isRefetching: snapshot.isRefetching,
    error: (snapshot.error as Error | null) ?? null,
    refetch: () => {
      void snapshot.refetch();
    },
  };
}

// ── Chat ────────────────────────────────────────────────────────────────────

export function useMessages(groupId: string | null) {
  const { status } = useAuth();

  return useQuery({
    queryKey: keys.messages(groupId ?? "none"),
    queryFn: () => api.fetchMessages(groupId!),
    enabled: status === "signedIn" && Boolean(groupId),
    staleTime: 15_000,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: string }) =>
      api.sendMessage(groupId, user!.id, body, uuid()),
    onSuccess: (row) => {
      queryClient.setQueryData<MessageRow[]>(keys.messages(row.group_id), (prev) => {
        if (!prev) return [row];
        if (prev.some((item) => item.id === row.id)) return prev;
        return [...prev, row];
      });
    },
  });
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
