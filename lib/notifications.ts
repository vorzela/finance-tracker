/**
 * lib/notifications.ts
 *
 * Local budget alerts. Fires when a category crosses 80% or 100% of its limit.
 * Deduped in AsyncStorage so the same threshold does not spam every refresh.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { BudgetStatus } from "@/types/finance";
import { formatMoney } from "@/lib/currency";

const SEEN_KEY = "duo-wallet.budget-alerts-seen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function readSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function writeSeen(seen: Set<string>): Promise<void> {
  const trimmed = [...seen].slice(-80);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

function alertKey(status: BudgetStatus, monthKey: string, level: "warn" | "over"): string {
  return `${monthKey}:${status.budget.id}:${level}`;
}

/**
 * Walks budget statuses for the active month and notifies on new crossings.
 * Safe to call often — already-seen thresholds are skipped.
 */
export async function notifyBudgetThresholds(
  statuses: BudgetStatus[],
  monthKey: string,
  currency: string,
): Promise<void> {
  if (statuses.length === 0) return;

  const permitted = await ensureNotificationPermission();
  if (!permitted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("budgets", {
      name: "Budget alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const seen = await readSeen();
  let changed = false;

  for (const status of statuses) {
    if (status.ratio >= 1) {
      const key = alertKey(status, monthKey, "over");
      if (!seen.has(key)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${status.label} budget used up`,
            body: `You've spent ${formatMoney(status.spent, currency)} of ${formatMoney(status.limit, currency)}.`,
            sound: true,
            ...(Platform.OS === "android" ? { channelId: "budgets" } : {}),
          },
          trigger: null,
        });
        seen.add(key);
        changed = true;
      }
    } else if (status.ratio >= 0.8) {
      const key = alertKey(status, monthKey, "warn");
      if (!seen.has(key)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${status.label} nearing its limit`,
            body: `${Math.round(status.ratio * 100)}% used · ${formatMoney(status.remaining, currency)} left.`,
            sound: true,
            ...(Platform.OS === "android" ? { channelId: "budgets" } : {}),
          },
          trigger: null,
        });
        seen.add(key);
        changed = true;
      }
    }
  }

  if (changed) await writeSeen(seen);
}
