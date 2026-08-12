/**
 * app/(app)/_layout.tsx
 *
 * The signed-in stack: tabs underneath, everything else pushed over the top.
 * Also the place the realtime subscription and monthly salary posting live, so
 * a shared ledger stays in sync no matter which screen is open.
 */

import { useAuth } from "@/lib/auth";
import { MonthProvider } from "@/lib/month";
import { useLedgerRealtime, usePostDueRecurring } from "@/lib/queries";
import { useThemeColors } from "@/lib/theme";
import { Redirect, Stack } from "expo-router";
import React from "react";
import { View } from "react-native";

function AppStack() {
  const colors = useThemeColors();
  useLedgerRealtime();
  usePostDueRecurring();

  return (
    <MonthProvider>
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
        <Stack.Screen name="debts" />
        <Stack.Screen name="income" />
        <Stack.Screen name="household" />
        <Stack.Screen name="profile" />
      </Stack>
    </MonthProvider>
  );
}

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "loading") return <View className="flex-1 bg-canvas" />;
  if (status === "unconfigured") return <Redirect href="/connect" />;
  if (status === "signedOut") return <Redirect href="/(auth)/sign-in" />;

  return <AppStack />;
}
