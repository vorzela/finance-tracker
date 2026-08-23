/**
 * lib/notifications.ts
 *
 * Local budget alerts and household chat pings. Budget crossings are deduped
 * in AsyncStorage so the same threshold does not spam every refresh.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { savePushToken } from "@/lib/api";
import type { BudgetStatus } from "@/types/finance";
import { formatMoney } from "@/lib/currency";

const SEEN_KEY = "duo-wallet.budget-alerts-seen";

/** Group whose chat screen is in the foreground — suppress banners for it. */
let viewingChatGroupId: string | null = null;

export function setViewingChatGroup(groupId: string | null): void {
  viewingChatGroupId = groupId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const groupId = notification.request.content.data?.groupId;
    const hide =
      typeof groupId === "string" &&
      viewingChatGroupId !== null &&
      groupId === viewingChatGroupId;
    return {
      shouldShowBanner: !hide,
      shouldShowList: true,
      shouldPlaySound: !hide,
      shouldSetBadge: false,
    };
  },
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

async function ensureChatChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("chat", {
    name: "Household chat",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Banner when a household message arrives and you are not looking at that chat. */
export async function notifyChatMessage(input: {
  groupId: string;
  title: string;
  body: string;
}): Promise<void> {
  if (viewingChatGroupId === input.groupId) return;

  const permitted = await ensureNotificationPermission();
  if (!permitted) return;
  await ensureChatChannel();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      data: { type: "chat", groupId: input.groupId },
      ...(Platform.OS === "android" ? { channelId: "chat" } : {}),
    },
    trigger: null,
  });
}

/** Stores this phone's Expo push token so the database can wake it. */
export async function registerPushToken(userId: string): Promise<void> {
  const permitted = await ensureNotificationPermission();
  if (!permitted) return;
  await ensureChatChannel();

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await savePushToken(userId, result.data, Platform.OS);
  } catch {
    // Simulator / missing EAS project: local Realtime banners still work.
  }
}
