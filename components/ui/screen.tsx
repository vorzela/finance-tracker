/**
 * components/ui/screen.tsx
 *
 * Page scaffolding: safe-area handling, the standard header, and the states a
 * screen shows before it has data.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ArrowLeftIcon, XIcon } from "phosphor-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className={cn("flex-1 bg-canvas", className)} style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}

export interface ScreenScrollProps extends ScrollViewProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Extra bottom padding, for screens sitting behind a tab bar or FAB. */
  bottomInset?: number;
}

export function ScreenScroll({
  children,
  onRefresh,
  refreshing = false,
  bottomInset = 32,
  contentContainerStyle,
  ...rest
}: ScreenScrollProps) {
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { paddingHorizontal: 16, paddingBottom: bottomInset, gap: 16 },
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        ) : undefined
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Shows a back arrow, or a cross when the screen is a modal. */
  back?: boolean | "close";
  right?: React.ReactNode;
  className?: string;
}

export function Header({ title, subtitle, back, right, className }: HeaderProps) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className={cn("flex-row items-center gap-3 px-4 pb-3 pt-1", className)}>
      {back ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface active:bg-subtle"
        >
          {back === "close" ? (
            <XIcon size={20} color={colors.ink} weight="bold" />
          ) : (
            <ArrowLeftIcon size={20} color={colors.ink} weight="bold" />
          )}
        </Pressable>
      ) : null}

      <View className="flex-1">
        <Text className="text-2xl font-bold tracking-tight text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator color={colors.brand} />
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, message, action, className }: EmptyStateProps) {
  return (
    <View className={cn("items-center gap-3 px-8 py-12", className)}>
      {icon ? (
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft">
          {icon}
        </View>
      ) : null}
      <Text className="text-center text-lg font-semibold tracking-tight text-ink">
        {title}
      </Text>
      {message ? (
        <Text className="text-center text-sm leading-5 text-muted">{message}</Text>
      ) : null}
      {action ? <View className="mt-2 w-full">{action}</View> : null}
    </View>
  );
}

/** Inline, dismissible error strip. Errors here are recoverable by retrying. */
export function ErrorNote({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border border-negative/30 bg-negative-soft px-4 py-3",
        className,
      )}
    >
      <Text className="flex-1 text-sm text-negative">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text className="text-sm font-semibold text-negative">Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
