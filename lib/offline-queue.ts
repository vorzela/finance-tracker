/**
 * lib/offline-queue.ts
 *
 * Durable write queue for when Supabase is unreachable. Entries flush when
 * the device comes back online (see lib/network.tsx).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccountDraft, Scope, TransactionDraft } from "@/types/finance";

const STORAGE_KEY = "duo-wallet.offline-queue";

export type OfflineOp =
  | {
      id: string;
      type: "createTransaction";
      scope: Scope;
      draft: TransactionDraft;
      clientId: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "updateTransaction";
      transactionId: string;
      draft: TransactionDraft;
      createdAt: number;
    }
  | {
      id: string;
      type: "deleteTransaction";
      transactionId: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "createAccount";
      scope: Scope;
      userId: string;
      draft: AccountDraft;
      clientId: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "updateAccount";
      accountId: string;
      draft: AccountDraft;
      createdAt: number;
    };

type Listener = (queue: OfflineOp[]) => void;

let memory: OfflineOp[] | null = null;
const listeners = new Set<Listener>();

async function read(): Promise<OfflineOp[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? (JSON.parse(raw) as OfflineOp[]) : [];
  } catch {
    memory = [];
  }
  return memory;
}

async function write(next: OfflineOp[]): Promise<void> {
  memory = next;
  listeners.forEach((listener) => listener(next));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export async function getOfflineQueue(): Promise<OfflineOp[]> {
  return read();
}

export function subscribeOfflineQueue(listener: Listener): () => void {
  listeners.add(listener);
  void read().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

type OfflineOpDraft = {
  [T in OfflineOp["type"]]: Omit<Extract<OfflineOp, { type: T }>, "id" | "createdAt">;
}[OfflineOp["type"]];

export async function enqueueOffline(
  op: OfflineOpDraft & { id?: string },
): Promise<OfflineOp> {
  const entry = {
    ...op,
    id: op.id ?? `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  } as OfflineOp;
  const queue = await read();
  await write([...queue, entry]);
  return entry;
}

export async function removeOfflineOp(id: string): Promise<void> {
  const queue = await read();
  await write(queue.filter((item) => item.id !== id));
}

export async function clearOfflineQueue(): Promise<void> {
  await write([]);
}

export function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("no connection") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("timed out") ||
    lower.includes("offline")
  );
}
