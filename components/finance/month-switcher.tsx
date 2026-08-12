/**
 * components/finance/month-switcher.tsx
 *
 * Moves the whole app one month at a time. Stepping past the current month is
 * blocked — there is nothing to see there, and an empty future month reads as a
 * bug rather than a boundary.
 */

import { cn } from "@/lib/cn";
import { addMonths, currentMonthKey, isCurrentMonth, monthLabel } from "@/lib/date";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

export interface MonthSwitcherProps {
  monthKey: string;
  onChange: (monthKey: string) => void;
  className?: string;
  /** Renders light-on-dark, for use inside the navy dashboard header. */
  inverted?: boolean;
}

export function MonthSwitcher({
  monthKey,
  onChange,
  className,
  inverted = false,
}: MonthSwitcherProps) {
  const atCurrent = isCurrentMonth(monthKey);

  const step = (delta: number) => {
    const next = addMonths(monthKey, delta);
    if (next > currentMonthKey()) return;
    void Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const arrowColor = inverted ? "#ffffff" : "#1e3a5f";

  return (
    <View className={cn("flex-row items-center gap-1", className)}>
      <Pressable
        onPress={() => step(-1)}
        hitSlop={10}
        className={cn(
          "h-9 w-9 items-center justify-center rounded-full",
          inverted ? "bg-white/15 active:bg-white/25" : "bg-white active:bg-gray-100",
        )}
      >
        <CaretLeftIcon size={16} color={arrowColor} weight="bold" />
      </Pressable>

      <Pressable
        onPress={() => !atCurrent && onChange(currentMonthKey())}
        className="min-w-[132px] items-center"
      >
        <Text
          className={cn(
            "text-sm font-bold tracking-tight",
            inverted ? "text-white" : "text-gray-900",
          )}
        >
          {atCurrent ? "This month" : monthLabel(monthKey)}
        </Text>
        {!atCurrent ? (
          <Text className={cn("text-[10px]", inverted ? "text-white/60" : "text-gray-400")}>
            Tap to return
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => step(1)}
        disabled={atCurrent}
        hitSlop={10}
        className={cn(
          "h-9 w-9 items-center justify-center rounded-full",
          inverted ? "bg-white/15" : "bg-white",
          atCurrent && "opacity-30",
        )}
      >
        <CaretRightIcon size={16} color={arrowColor} weight="bold" />
      </Pressable>
    </View>
  );
}
