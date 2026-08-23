/**
 * components/finance/month-switcher.tsx
 *
 * Compact month pager — quiet chrome that works on canvas or hero.
 */

import { AppText } from "@/components/ui/app-text";

import { cn } from "@/lib/cn";
import { addMonths, currentMonthKey, isCurrentMonth, monthLabel } from "@/lib/date";
import { useThemeColors } from "@/lib/theme";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import React from "react";
import { Pressable, View } from "react-native";

export interface MonthSwitcherProps {
  monthKey: string;
  onChange: (monthKey: string) => void;
  className?: string;
  inverted?: boolean;
}

export function MonthSwitcher({
  monthKey,
  onChange,
  className,
  inverted = false,
}: MonthSwitcherProps) {
  const colors = useThemeColors();
  const atCurrent = isCurrentMonth(monthKey);

  const step = (delta: number) => {
    const next = addMonths(monthKey, delta);
    if (next > currentMonthKey()) return;
    void Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };

  const arrowColor = inverted ? "#ffffff" : colors.ink;
  const chipBg = inverted ? "rgba(255,255,255,0.18)" : colors.subtle;
  const labelColor = inverted ? "#ffffff" : colors.ink;
  const hintColor = inverted ? "rgba(255,255,255,0.65)" : colors.muted;

  return (
    <View className={cn("flex-row items-center gap-1", className)}>
      <Pressable
        onPress={() => step(-1)}
        hitSlop={10}
        className="will-change-pressable h-8 w-8 items-center justify-center rounded-full active:opacity-70"
        style={{ backgroundColor: chipBg }}
      >
        <CaretLeftIcon size={14} color={arrowColor} weight="bold" />
      </Pressable>

      <Pressable
        onPress={() => !atCurrent && onChange(currentMonthKey())}
        className="min-w-[120px] items-center px-1"
      >
        <AppText
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: labelColor }}
        >
          {atCurrent ? "This month" : monthLabel(monthKey)}
        </AppText>
        {!atCurrent ? (
          <AppText className="text-[10px]" style={{ color: hintColor }}>
            Tap to return
          </AppText>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => step(1)}
        disabled={atCurrent}
        hitSlop={10}
        className="will-change-pressable h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: chipBg, opacity: atCurrent ? 0.35 : 1 }}
      >
        <CaretRightIcon size={14} color={arrowColor} weight="bold" />
      </Pressable>
    </View>
  );
}
