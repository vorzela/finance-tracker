/**
 * app/_layout.tsx
 *
 * Providers, in the order they depend on each other: theme first (so the
 * splash and every screen below know the scheme), React Query next (the auth
 * provider clears its cache on sign-out), then auth, then the active ledger.
 *
 * The splash screen is held until auth has resolved so the app never flashes
 * the sign-in screen at someone who is already signed in.
 */

import "react-native-url-polyfill/auto";
import "../global.css";

import { AuthProvider, useAuth } from "@/lib/auth";
import { ScopeProvider } from "@/lib/scope";
import { ThemeProvider, useTheme, useThemeColors } from "@/lib/theme";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Keep inactive month caches short so phones with less RAM stay light.
      gcTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
      gcTime: 60_000,
    },
  },
});

focusManager.setEventListener((handleFocus) => {
  const onChange = (status: AppStateStatus) => handleFocus(status === "active");
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
});

function SplashGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { isReady } = useTheme();

  useEffect(() => {
    if (status !== "loading" && isReady) {
      void SplashScreen.hideAsync();
    }
  }, [status, isReady]);

  return <>{children}</>;
}

function RootStack() {
  const { scheme } = useTheme();
  const colors = useThemeColors();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="connect" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ScopeProvider>
                <KeyboardProvider>
                  <SplashGate>
                    <RootStack />
                  </SplashGate>
                </KeyboardProvider>
              </ScopeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
