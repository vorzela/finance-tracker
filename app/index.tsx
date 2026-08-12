/**
 * app/index.tsx
 *
 * Entry point: sends you to the connect screen, the sign-in screen, or the app,
 * depending on what is already known. Renders nothing while auth resolves —
 * the native splash is still on top at that point.
 */

import { useAuth } from "@/lib/auth";
import { Redirect } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function Index() {
  const { status } = useAuth();

  if (status === "loading") return <View className="flex-1 bg-navy-800" />;
  if (status === "unconfigured") return <Redirect href="/connect" />;
  if (status === "signedOut") return <Redirect href="/(auth)/sign-in" />;

  return <Redirect href="/(app)/(tabs)" />;
}
