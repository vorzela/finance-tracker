/**
 * components/ui/card.tsx
 *
 * Soft elevated surfaces — Apple Settings / Material You cards without noisy borders.
 */

import { AppText } from "@/components/ui/app-text";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import { CaretRightIcon } from "phosphor-react-native";
import React from "react";
import { Pressable, View, type PressableProps, type ViewStyle } from "react-native";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Removes the inner padding, for cards that hold their own list rows. */
  flush?: boolean;
  style?: ViewStyle;
}

export function Card({ children, className, flush = false, style }: CardProps) {
  const colors = useThemeColors();

  return (
    <View
      className={cn("overflow-hidden rounded-[22px] bg-surface", !flush && "p-5", className)}
      style={[
        {
          shadowColor: colors.chrome,
          shadowOpacity: colors.heroInverted ? 0.35 : 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface SectionProps {
  title: string;
  /** Right-hand affordance, usually a "See all" button. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <View className={cn("gap-2.5", className)}>
      <View className="flex-row items-center justify-between px-1">
        <AppText className="text-[15px] font-semibold tracking-tight text-ink">{title}</AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

export interface RowProps extends Omit<PressableProps, "children" | "className" | "style"> {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: React.ReactNode;
  chevron?: boolean;
  danger?: boolean;
  className?: string;
  last?: boolean;
}

/** List row sized for comfortable one-thumb tapping (HIG / Material). */
export function Row({
  leading,
  title,
  subtitle,
  value,
  chevron = false,
  danger = false,
  className,
  last = false,
  onPress,
  ...rest
}: RowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        "will-change-pressable flex-row items-center gap-3.5 px-4 py-[14px]",
        !last && "border-b border-hairline",
        onPress && "active:bg-subtle",
        className,
      )}
      {...rest}
    >
      {leading}

      <View className="flex-1">
        <AppText
          className={cn(
            "text-[17px] font-medium tracking-tight",
            danger ? "text-negative" : "text-ink",
          )}
          numberOfLines={1}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText className="mt-0.5 text-[13px] leading-4 text-muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {value}
      {chevron ? <CaretRightIcon size={16} color={colors.faint} weight="bold" /> : null}
    </Pressable>
  );
}

/** Soft tonal tile for a row's leading icon. */
export function IconTile({
  color,
  children,
  size = 36,
}: {
  color: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-[11px]"
      style={{ width: size, height: size, backgroundColor: `${color}18` }}
    >
      {children}
    </View>
  );
}
