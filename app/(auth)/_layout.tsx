/**
 * app/(auth)/_layout.tsx
 *
 * The signed-out stack. Anyone who already has a session is bounced straight
 * into the app, which also covers the moment sign-in succeeds.
 */

import { useAuth } from "@/lib/auth";
import { Redirect, Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  const { status } = useAuth();

  if (status === "signedIn") return <Redirect href="/(app)/(tabs)" />;
  if (status === "unconfigured") return <Redirect href="/connect" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0d1c33" },
        animation: "slide_from_right",
      }}
    />
  );
}
