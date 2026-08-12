/**
 * components/ui/card.tsx
 *
 * The surfaces everything else sits on: a plain white card, a pressable row,
 * and the section header that labels a group of them.
 */

import { cn } from "@/lib/cn";
import { CaretRightIcon } from "phosphor-react-native";
import React from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Removes the inner padding, for cards that hold their own list rows. */
  flush?: boolean;
}

export function Card({ children, className, flush = false }: CardProps) {
  return (
    <View
      className={cn(
        "rounded-3xl border border-hairline bg-surface",
        !flush && "p-5",
        className,
      )}
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
    <View className={cn("gap-3", className)}>
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export interface RowProps extends Omit<PressableProps, "children" | "className" | "style"> {
  /** Leading element, usually an icon tile or avatar. */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right-hand value, e.g. an amount. */
  value?: React.ReactNode;
  /** Shows a chevron to signal navigation. */
  chevron?: boolean;
  danger?: boolean;
  className?: string;
  /** Hides the hairline, for the last row in a card. */
  last?: boolean;
}

/** A list row sized for comfortable one-thumb tapping. */
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        "flex-row items-center gap-3 px-5 py-4",
        !last && "border-b border-hairline",
        onPress && "active:bg-subtle",
        className,
      )}
      {...rest}
    >
      {leading}

      <View className="flex-1">
        <Text
          className={cn(
            "text-base font-semibold tracking-tight",
            danger ? "text-negative" : "text-ink",
          )}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value}
      {chevron && <CaretRightIcon size={18} color="#9aa9bd" weight="bold" />}
    </Pressable>
  );
}

/** Square tinted tile used as a row's leading icon. */
export function IconTile({
  color,
  children,
  size = 40,
}: {
  color: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{ width: size, height: size, backgroundColor: `${color}1a` }}
    >
      {children}
    </View>
  );
}
