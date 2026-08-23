/**
 * components/ui/tab-bar.tsx
 *
 * Edge-to-edge bottom bar (not floating). Compose sits flush in the center.
 */

import { AppText } from "@/components/ui/app-text";

import { useChat } from "@/lib/chat";
import { useThemeColors } from "@/lib/theme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChartPieSliceIcon,
  ChatCircleIcon,
  GearSixIcon,
  HouseIcon,
  PlusIcon,
  ReceiptIcon,
  type Icon,
} from "phosphor-react-native";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TABS: Record<string, { label: string; glyph: Icon }> = {
  index: { label: "Home", glyph: HouseIcon },
  activity: { label: "Activity", glyph: ReceiptIcon },
  chat: { label: "Chat", glyph: ChatCircleIcon },
  insights: { label: "Insights", glyph: ChartPieSliceIcon },
  settings: { label: "Settings", glyph: GearSixIcon },
};

/** Row height above the home-indicator / nav inset. */
export const TAB_BAR_HEIGHT = 58;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { unreadByGroup } = useChat();
  const unread = Object.values(unreadByGroup).reduce((sum, count) => sum + count, 0);

  const routes = state.routes.filter((route) => route.name in TABS);
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const config = TABS[route.name];
    const index = state.routes.findIndex((candidate) => candidate.key === route.key);
    const isActive = state.index === index;
    const Glyph = config.glyph;
    const showUnread = route.name === "chat" && unread > 0;

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          if (isActive) return;
          void Haptics.selectionAsync().catch(() => {});
          navigation.navigate(route.name);
        }}
        className="will-change-pressable flex-1 items-center justify-center gap-0.5 py-1.5"
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={showUnread ? `Chat, ${unread} unread` : config.label}
      >
        <View>
          <Glyph
            size={22}
            color={isActive ? colors.brand : colors.faint}
            weight={isActive ? "fill" : "regular"}
          />
          {showUnread ? (
            <View
              className="absolute -right-2.5 -top-1 min-w-[16px] items-center rounded-full px-1"
              style={{ backgroundColor: colors.negative, height: 16 }}
            >
              <AppText className="text-[9px] font-bold leading-[16px]" style={{ color: colors.onBrand }}>
                {unread > 9 ? "9+" : unread}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText
          className="text-[10px] font-medium tracking-tight"
          style={{ color: isActive ? colors.brand : colors.faint }}
        >
          {config.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        className="flex-row items-center px-1"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        {routes.slice(0, half).map(renderTab)}

        <View className="w-16 items-center justify-center">
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
            className="will-change-pressable h-11 w-11 items-center justify-center rounded-full active:opacity-85"
            style={{ backgroundColor: colors.brand }}
            accessibilityLabel="Add a transaction"
          >
            <PlusIcon size={22} color={colors.onBrand} weight="bold" />
          </Pressable>
        </View>

        {routes.slice(half).map(renderTab)}
      </View>
    </View>
  );
}
