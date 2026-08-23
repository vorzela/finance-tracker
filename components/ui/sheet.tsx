/**
 * components/ui/sheet.tsx
 *
 * Bottom sheet — clean grabber, grouped options, soft dimmer.
 */

import { AppText } from "@/components/ui/app-text";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import { CheckIcon } from "phosphor-react-native";
import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
  footer?: React.ReactNode;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.78,
  footer,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(140)}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
      >
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />

        <Animated.View
          entering={SlideInDown.duration(280)}
          className="rounded-t-[28px] bg-surface"
          style={{
            maxHeight: `${maxHeightRatio * 100}%`,
            paddingBottom: insets.bottom + 10,
            shadowColor: colors.chrome,
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -4 },
            elevation: 16,
          }}
        >
          <View className="items-center pt-2.5">
            <View className="h-1 w-9 rounded-full bg-faint/50" />
          </View>

          <View className="px-5 pb-3 pt-4">
            <AppText className="text-[22px] font-bold tracking-tight text-ink">{title}</AppText>
            {subtitle ? (
              <AppText className="mt-1 text-[14px] leading-5 text-muted">{subtitle}</AppText>
            ) : null}
          </View>

          <ScrollView
            className="px-3"
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? (
            <View className="border-t border-hairline px-5 pt-4">{footer}</View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export interface SheetOptionProps {
  label: string;
  description?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  onPress: () => void;
}

export function SheetOption({
  label,
  description,
  leading,
  trailing,
  selected = false,
  onPress,
}: SheetOptionProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      className="will-change-pressable mb-1 flex-row items-center gap-3 rounded-[14px] px-3 py-3"
      style={selected ? { backgroundColor: colors.brandSoft } : undefined}
    >
      {leading}

      <View className="flex-1">
        <AppText
          className={cn(
            "text-[16px] tracking-tight",
            selected ? "font-semibold" : "font-medium text-ink",
          )}
          style={selected ? { color: colors.brand } : undefined}
          numberOfLines={1}
        >
          {label}
        </AppText>
        {description ? (
          <AppText className="mt-0.5 text-[13px] text-muted" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>

      {trailing}
      {selected ? <CheckIcon size={18} color={colors.brand} weight="bold" /> : null}
    </Pressable>
  );
}

export function SheetGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2 px-2 pb-2">{children}</View>;
}
