/**
 * components/ui/tab-bar.tsx
 *
 * Floating tab bar with the add button raised in the middle. Active icons and
 * the + button follow the selected colour theme.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChartPieSliceIcon,
  GearSixIcon,
  HouseIcon,
  PlusIcon,
  ReceiptIcon,
  type Icon,
} from "phosphor-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS: Record<string, { label: string; glyph: Icon }> = {
  index: { label: "Home", glyph: HouseIcon },
  activity: { label: "Activity", glyph: ReceiptIcon },
  insights: { label: "Insights", glyph: ChartPieSliceIcon },
  settings: { label: "Settings", glyph: GearSixIcon },
};

/** Height the tab bar occupies, so scroll views can pad past it. */
export const TAB_BAR_HEIGHT = 76;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();

  const routes = state.routes.filter((route) => route.name in TABS);
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const config = TABS[route.name];
    const index = state.routes.findIndex((candidate) => candidate.key === route.key);
    const isActive = state.index === index;
    const Glyph = config.glyph;

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          if (isActive) return;
          void Haptics.selectionAsync().catch(() => {});
          navigation.navigate(route.name);
        }}
        className="flex-1 items-center justify-center gap-1 py-2"
      >
        <Glyph
          size={23}
          color={isActive ? colors.brand : colors.faint}
          weight={isActive ? "fill" : "regular"}
        />
        <Text
          className={cn(
            "text-[10px] font-semibold tracking-tight",
            isActive ? "text-brand" : "text-gray-400",
          )}
          style={isActive ? { color: colors.brand } : undefined}
        >
          {config.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      className="absolute inset-x-0 bottom-0"
      style={{ paddingBottom: insets.bottom + 10, paddingHorizontal: 16 }}
      pointerEvents="box-none"
    >
      <View
        className="flex-row items-center rounded-[28px] border border-gray-200/70 bg-white px-2"
        style={{
          height: TAB_BAR_HEIGHT - 16,
          shadowColor: colors.chrome,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {routes.slice(0, half).map(renderTab)}

        <View className="w-16 items-center">
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push("/entry");
            }}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              router.push("/import-mpesa" as never);
            }}
            delayLongPress={350}
            className="h-14 w-14 items-center justify-center rounded-full active:opacity-80"
            style={{
              marginTop: -28,
              backgroundColor: colors.brand,
              shadowColor: colors.brand,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 10,
            }}
            accessibilityLabel="Add a transaction"
          >
            <PlusIcon size={26} color={colors.onBrand} weight="bold" />
          </Pressable>
        </View>

        {routes.slice(half).map(renderTab)}
      </View>
    </View>
  );
}
