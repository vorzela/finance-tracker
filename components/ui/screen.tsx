/**
 * components/ui/screen.tsx
 *
 * Page scaffolding with large-title headers and calm empty / error states.
 */

import { AppText } from "@/components/ui/app-text";
import { RowsSkeleton } from "@/components/ui/shimmer";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ArrowLeftIcon, XIcon } from "phosphor-react-native";
import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
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
  bottomInset?: number;
}

export function ScreenScroll({
  children,
  onRefresh,
  refreshing = false,
  bottomInset = 40,
  contentContainerStyle,
  ...rest
}: ScreenScrollProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const padBottom = bottomInset + (bottomInset >= 50 ? insets.bottom : 0);

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingBottom: padBottom, gap: 20 },
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
  back?: boolean | "close";
  right?: React.ReactNode;
  className?: string;
  /** Large title treatment (iOS-style). Default true when no back control. */
  large?: boolean;
}

export function Header({
  title,
  subtitle,
  back,
  right,
  className,
  large,
}: HeaderProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const useLarge = large ?? !back;

  return (
    <View
      className={cn(
        "flex-row items-center gap-3 px-5",
        useLarge ? "pb-2 pt-2" : "pb-3 pt-1",
        className,
      )}
    >
      {back ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="will-change-pressable h-9 w-9 items-center justify-center rounded-full bg-subtle active:opacity-70"
        >
          {back === "close" ? (
            <XIcon size={18} color={colors.ink} weight="bold" />
          ) : (
            <ArrowLeftIcon size={18} color={colors.ink} weight="bold" />
          )}
        </Pressable>
      ) : null}

      <View className="flex-1">
        <AppText
          className={cn(
            "font-bold tracking-tight text-ink",
            useLarge ? "text-[34px] leading-10" : "text-[17px] leading-6",
          )}
          numberOfLines={1}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right}
    </View>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <View
      className="flex-1 px-5 py-4"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <RowsSkeleton count={5} />
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
    <View className={cn("items-center gap-3 px-6 py-14", className)}>
      {icon ? (
        <View className="mb-1 h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-brand-soft">
          {icon}
        </View>
      ) : null}
      <AppText className="text-center text-[20px] font-semibold tracking-tight text-ink">
        {title}
      </AppText>
      {message ? (
        <AppText className="max-w-[280px] text-center text-[15px] leading-5 text-muted">
          {message}
        </AppText>
      ) : null}
      {action ? <View className="mt-3 w-full max-w-[280px]">{action}</View> : null}
    </View>
  );
}

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
        "flex-row items-center gap-3 rounded-2xl bg-negative-soft px-4 py-3.5",
        className,
      )}
    >
      <AppText className="flex-1 text-[14px] leading-5 text-negative">{message}</AppText>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} className="active:opacity-60">
          <AppText className="text-[14px] font-semibold text-negative">Retry</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
