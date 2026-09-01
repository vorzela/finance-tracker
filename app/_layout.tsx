/**
 * app/_layout.tsx
 *
 * Providers, fonts and the root stack. Theme (scheme + accent + font) loads
 * first so splash does not flash the wrong palette.
 */

import "react-native-url-polyfill/auto";
import "../global.css";

import {
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_600SemiBold,
  Literata_700Bold,
} from "@expo-google-fonts/literata";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_600SemiBold,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  PublicSans_400Regular,
  PublicSans_400Regular_Italic,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from "@expo-google-fonts/public-sans";
import {
  Roboto_400Regular,
  Roboto_400Regular_Italic,
  Roboto_500Medium,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from "@expo-google-fonts/source-serif-4";
import { AccentRoot } from "@/components/ui/accent-root";
import { ErrorBoundary } from "@/components/error-boundary";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AuthProvider, useAuth } from "@/lib/auth";
import { NetworkProvider } from "@/lib/network";
import { ScopeProvider } from "@/lib/scope";
import { ThemeProvider, useAppearance, useThemeColors } from "@/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AppState, View, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: "always",
    },
  },
});

const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "duo-wallet.rq-cache",
  throttleTime: 1500,
});

focusManager.setEventListener((handleFocus) => {
  const onChange = (status: AppStateStatus) => handleFocus(status === "active");
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
});

function SplashGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { isReady } = useAppearance();
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_400Regular_Italic,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    Roboto_400Regular,
    Roboto_400Regular_Italic,
    Roboto_500Medium,
    Roboto_700Bold,
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    DMSans_400Regular,
    DMSans_400Regular_Italic,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    SourceSerif4_400Regular,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Nunito_400Regular,
    Nunito_400Regular_Italic,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_600SemiBold,
    Literata_700Bold,
  });

  useEffect(() => {
    if (status !== "loading" && isReady && fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [status, isReady, fontsLoaded]);

  if (!fontsLoaded) return null;
  return <>{children}</>;
}

function RootStack() {
  const { scheme, font, italic } = useAppearance();
  const colors = useThemeColors();
  const fontKey = `${font}:${italic ? "i" : "r"}`;

  return (
    <View key={fontKey} style={{ flex: 1, backgroundColor: colors.canvas }}>
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
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AccentRoot>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: queryPersister,
                maxAge: 1000 * 60 * 60 * 24 * 7,
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) => query.state.status === "success",
                },
              }}
            >
              <NetworkProvider>
                <AuthProvider>
                  <ScopeProvider>
                    <KeyboardProvider>
                      <BottomSheetModalProvider>
                        <SplashGate>
                          <ErrorBoundary>
                            <RootStack />
                          </ErrorBoundary>
                        </SplashGate>
                      </BottomSheetModalProvider>
                    </KeyboardProvider>
                  </ScopeProvider>
                </AuthProvider>
              </NetworkProvider>
            </PersistQueryClientProvider>
          </AccentRoot>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
