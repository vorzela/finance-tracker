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
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from "@expo-google-fonts/source-serif-4";
import { AccentRoot } from "@/components/ui/accent-root";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ScopeProvider } from "@/lib/scope";
import { fontFamilyName, ThemeProvider, useAppearance, useThemeColors } from "@/lib/theme";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { AppState, Text, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
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
  const { isReady } = useAppearance();
  const [fontsLoaded] = useFonts({
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
  const fontFamily = fontFamilyName(font, italic);

  useEffect(() => {
    const TextWithDefaults = Text as typeof Text & {
      defaultProps?: { style?: object | object[] };
    };
    TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
    const prev = TextWithDefaults.defaultProps.style;
    TextWithDefaults.defaultProps.style = [{ fontFamily }, prev].flat().filter(Boolean);
  }, [fontFamily]);

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
          <AccentRoot>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ScopeProvider>
                  <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
                    <SplashGate>
                      <RootStack />
                    </SplashGate>
                  </KeyboardProvider>
                </ScopeProvider>
              </AuthProvider>
            </QueryClientProvider>
          </AccentRoot>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
