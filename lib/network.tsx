/**
 * lib/network.tsx
 *
 * Wires NetInfo into React Query, flushes the offline write queue when the
 * device comes back online, and exposes a small online/pending status for the UI.
 */

import * as api from "@/lib/api";
import {
  getOfflineQueue,
  isNetworkFailure,
  removeOfflineOp,
  subscribeOfflineQueue,
  type OfflineOp,
} from "@/lib/offline-queue";
import { useThemeColors } from "@/lib/theme";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppText } from "@/components/ui/app-text";
import {
  AppState,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    const reachable = state.isInternetReachable;
    const online =
      Boolean(state.isConnected) &&
      (reachable === null || reachable === undefined ? true : reachable);
    setOnline(online);
  });
});

interface NetworkContextValue {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  flush: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

async function applyOp(op: OfflineOp): Promise<void> {
  switch (op.type) {
    case "createTransaction":
      await api.createTransaction(op.scope, op.draft, op.clientId);
      return;
    case "updateTransaction":
      await api.updateTransaction(op.transactionId, op.draft);
      return;
    case "deleteTransaction":
      await api.deleteTransaction(op.transactionId);
      return;
    case "createAccount":
      await api.createAccount(op.scope, op.userId, op.draft, op.clientId);
      return;
    case "updateAccount":
      await api.updateAccount(op.accountId, op.draft);
      return;
  }
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(onlineManager.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  useEffect(() => subscribeOfflineQueue((queue) => setPendingCount(queue.length)), []);

  useEffect(() => {
    const unsub = onlineManager.subscribe(() => {
      setOnline(onlineManager.isOnline());
    });
    return unsub;
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || !onlineManager.isOnline()) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const queue = await getOfflineQueue();
      for (const op of queue) {
        if (!onlineManager.isOnline()) break;
        try {
          await applyOp(op);
          await removeOfflineOp(op.id);
        } catch (error) {
          if (isNetworkFailure(error)) {
            // Still offline / connection dropped mid-sync — stop for now,
            // the next flush (reconnect, foreground, poll) will retry this
            // same op from where we left off.
            console.warn("[offline] sync paused, network failure", op.type, error);
            break;
          }
          // A permanent failure (bad data, RLS rejection, stale reference,
          // etc.) will never succeed no matter how many times we retry it.
          // Drop it and keep going, so one bad entry can't block every
          // later op from ever syncing.
          console.warn("[offline] dropping op that can't sync", op.type, error);
          await removeOfflineOp(op.id);
        }
      }
      await queryClient.invalidateQueries();
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (online && pendingCount > 0) {
      void flush();
    }
  }, [online, pendingCount, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && onlineManager.isOnline()) void flush();
    });
    return () => sub.remove();
  }, [flush]);

  const value = useMemo(
    () => ({ online, pendingCount, syncing, flush }),
    [online, pendingCount, syncing, flush],
  );

  return (
    <NetworkContext.Provider value={value}>
      {children}
      <OfflineBanner />
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext);
  if (!value) throw new Error("useNetwork must be used inside NetworkProvider");
  return value;
}

function OfflineBanner() {
  const network = useContext(NetworkContext);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  if (!network) return null;
  if (network.online && !network.syncing && network.pendingCount === 0) return null;

  const offline = !network.online;
  const backgroundColor = offline ? colors.warn : colors.brand;
  const message = offline
    ? `Offline — saves stay on this phone${
        network.pendingCount > 0 ? ` · ${network.pendingCount} waiting` : ""
      }`
    : network.syncing
      ? "Syncing offline changes…"
      : `${network.pendingCount} change${network.pendingCount === 1 ? "" : "s"} waiting to sync`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: insets.top + 8,
        zIndex: 50,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor,
      }}
    >
      <AppText style={{ color: "#ffffff", textAlign: "center", fontSize: 13, fontWeight: "600" }}>
        {message}
      </AppText>
    </View>
  );
}
