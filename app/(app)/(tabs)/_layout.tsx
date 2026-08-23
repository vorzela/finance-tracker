/**
 * app/(app)/(tabs)/_layout.tsx
 *
 * Five tabs, drawn by the custom bar in `components/ui/tab-bar.tsx`.
 */

import { TabBar } from "@/components/ui/tab-bar";
import { useThemeColors } from "@/lib/theme";
import { Tabs } from "expo-router";
import React from "react";

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen
        name="chat"
        options={{ title: "Chat", tabBarHideOnKeyboard: true }}
      />
      <Tabs.Screen name="insights" options={{ title: "Insights" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
