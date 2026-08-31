/**
 * lib/scope.tsx
 *
 * Holds the ledger the app is currently showing — your own, or one you share.
 *
 * The choice is remembered per user in AsyncStorage, and validated against the
 * groups you are still a member of: leaving a group on one phone must not leave
 * the other stuck on a ledger it can no longer read.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchGroups, keys } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  PERSONAL_SCOPE,
  parseScopeKey,
  scopeKey,
  type GroupSummary,
  type Scope,
} from "@/types/finance";

const STORAGE_PREFIX = "duo-wallet.scope.";

interface ScopeValue {
  scope: Scope;
  setScope: (scope: Scope) => void;
  /** Groups you belong to, oldest membership first. */
  groups: GroupSummary[];
  /** The group behind the active scope, or `null` when personal. */
  activeGroup: GroupSummary | null;
  isLoading: boolean;
  /** True once the remembered choice has been read back. */
  isReady: boolean;
  refetchGroups: () => Promise<unknown>;
}

const ScopeContext = createContext<ScopeValue | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const userId = user?.id ?? null;

  const [scope, setScopeState] = useState<Scope>(PERSONAL_SCOPE);
  const [isRestored, setIsRestored] = useState(false);

  const groupsQuery = useQuery({
    queryKey: userId ? keys.groups(userId) : ["groups", "anonymous"],
    queryFn: () => fetchGroups(userId!),
    enabled: status === "signedIn" && Boolean(userId),
    staleTime: 30_000,
  });

  const groups = groupsQuery.data ?? [];

  // Read the remembered ledger once per signed-in user.
  useEffect(() => {
    if (!userId) {
      setScopeState(PERSONAL_SCOPE);
      setIsRestored(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_PREFIX + userId).catch(() => null);
      if (cancelled) return;
      setScopeState(parseScopeKey(stored) ?? PERSONAL_SCOPE);
      setIsRestored(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fall back to the personal ledger if the remembered group is gone.
  useEffect(() => {
    if (!groupsQuery.isSuccess || scope.kind !== "group") return;
    if (groups.some((group) => group.id === scope.groupId)) return;
    setScopeState(PERSONAL_SCOPE);
  }, [groupsQuery.isSuccess, groups, scope]);

  const setScope = useCallback(
    (next: Scope) => {
      setScopeState(next);
      if (userId) {
        void AsyncStorage.setItem(STORAGE_PREFIX + userId, scopeKey(next));
      }
    },
    [userId],
  );

  const value = useMemo<ScopeValue>(() => {
    const activeGroup =
      scope.kind === "group"
        ? (groups.find((group) => group.id === scope.groupId) ?? null)
        : null;

    return {
      scope,
      setScope,
      groups,
      activeGroup,
      isLoading: groupsQuery.isLoading,
      isReady: isRestored && !groupsQuery.isLoading,
      refetchGroups: groupsQuery.refetch,
    };
  }, [scope, setScope, groups, groupsQuery.isLoading, groupsQuery.refetch, isRestored]);

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeValue {
  const value = useContext(ScopeContext);
  if (!value) throw new Error("useScope must be used inside <ScopeProvider>");
  return value;
}

/** Label for the active ledger, e.g. "Personal" or "Home". */
export function useScopeLabel(): string {
  const { scope, activeGroup } = useScope();
  if (scope.kind === "personal") return "Personal";
  return activeGroup?.name ?? "Shared";
}
