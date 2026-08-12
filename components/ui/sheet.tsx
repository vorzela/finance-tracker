/**
 * components/ui/sheet.tsx
 *
 * Bottom sheet used for every picker in the app — category, account, person,
 * date. Built on the platform `Modal` so it sits above the tab bar and handles
 * the Android back button for free.
 */

import { cn } from "@/lib/cn";
import { CheckIcon } from "phosphor-react-native";
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Sheet grows with content up to this share of the screen. */
  maxHeightRatio?: number;
  footer?: React.ReactNode;
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.8,
  footer,
}: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />

        <Animated.View
          entering={SlideInDown.duration(240)}
          className="rounded-t-[28px] bg-white"
          style={{ maxHeight: `${maxHeightRatio * 100}%`, paddingBottom: insets.bottom + 8 }}
        >
          <View className="items-center pt-3">
            <View className="h-1.5 w-10 rounded-full bg-gray-200" />
          </View>

          <View className="px-5 pb-2 pt-4">
            <Text className="text-xl font-bold tracking-tight text-gray-900">{title}</Text>
            {subtitle ? (
              <Text className="mt-1 text-sm text-gray-500">{subtitle}</Text>
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

          {footer ? <View className="border-t border-gray-100 px-5 pt-4">{footer}</View> : null}
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
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "mb-1 flex-row items-center gap-3 rounded-2xl px-3 py-3",
        selected ? "bg-navy-50" : "active:bg-gray-50",
      )}
    >
      {leading}

      <View className="flex-1">
        <Text
          className={cn(
            "text-base tracking-tight",
            selected ? "font-bold text-navy-600" : "font-medium text-gray-900",
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description ? (
          <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>

      {trailing}
      {selected && <CheckIcon size={20} color="#1e3a5f" weight="bold" />}
    </Pressable>
  );
}

/** Grid layout for pickers with many short options, e.g. categories. */
export function SheetGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2 px-2 pb-2">{children}</View>;
}
