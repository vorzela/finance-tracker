/**
 * app/(app)/_layout.tsx
 *
 * The signed-in stack: tabs underneath, everything else pushed over the top.
 * Realtime, monthly salary posting, and budget-limit notifications live here.
 */

import { useAuth } from "@/lib/auth";
import { budgetStatuses } from "@/lib/analytics";
import { ChatProvider } from "@/lib/chat";
import { MonthProvider, useMonth } from "@/lib/month";
import { notifyBudgetThresholds } from "@/lib/notifications";
import { useCurrency, useLedgerRealtime, useLedgerSnapshot, usePostDueRecurring } from "@/lib/queries";
import { useThemeColors } from "@/lib/theme";
import { Redirect, Stack } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";

function BudgetAlerts() {
  const { monthKey } = useMonth();
  const currency = useCurrency();
  const snapshot = useLedgerSnapshot(monthKey);

  const statuses = useMemo(
    () =>
      budgetStatuses(snapshot.data?.budgets ?? [], snapshot.data?.transactions ?? [], monthKey),
    [snapshot.data, monthKey],
  );

  useEffect(() => {
    if (statuses.length === 0) return;
    void notifyBudgetThresholds(statuses, monthKey, currency).catch(() => {});
  }, [statuses, monthKey, currency]);

  return null;
}

function AppStack() {
  const colors = useThemeColors();
  useLedgerRealtime();
  usePostDueRecurring();

  return (
    <ChatProvider>
      <MonthProvider>
        <BudgetAlerts />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="entry"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="accounts" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="plans" />
          <Stack.Screen name="debts" />
          <Stack.Screen name="income" />
          <Stack.Screen name="import-mpesa" />
          <Stack.Screen name="household" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="help" />
          <Stack.Screen name="usage" />
          <Stack.Screen name="faq" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="privacy" />
        </Stack>
      </MonthProvider>
    </ChatProvider>
  );
}

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "loading") return <View className="flex-1 bg-canvas" />;
  if (status === "unconfigured") return <Redirect href="/connect" />;
  if (status === "signedOut") return <Redirect href="/(auth)/sign-in" />;

  return <AppStack />;
}
