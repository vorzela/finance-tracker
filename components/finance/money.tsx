/**
 * components/finance/money.tsx
 *
 * Amount text with quiet semantic colour for direction.
 */

import { AppText } from "@/components/ui/app-text";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/currency";
import { useThemeColors } from "@/lib/theme";
import React from "react";
import { View } from "react-native";
import type { TransactionKind } from "@/types/database";

const SIZES = {
  sm: "text-[13px]",
  md: "text-[16px]",
  lg: "text-[24px]",
  xl: "text-[34px]",
  hero: "text-[44px]",
} as const;

export interface MoneyProps {
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  kind?: TransactionKind;
  showSign?: boolean;
  compact?: boolean;
  className?: string;
  muted?: boolean;
}

export function Money({
  amount,
  currency,
  size = "md",
  kind,
  showSign,
  compact = false,
  className,
  muted = false,
}: MoneyProps) {
  const colors = useThemeColors();
  const signed = showSign ?? Boolean(kind);
  const value = kind === "expense" ? -Math.abs(amount) : amount;

  const color = muted
    ? colors.faint
    : kind === "income"
      ? colors.positive
      : kind === "transfer"
        ? colors.muted
        : colors.ink;

  return (
    <AppText
      className={cn("font-semibold tracking-tight tabular-nums", SIZES[size], className)}
      style={{ color }}
      numberOfLines={1}
    >
      {formatMoney(signed ? value : amount, currency, { showSign: signed, compact })}
    </AppText>
  );
}

export function MoneyHero({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  const colors = useThemeColors();
  const formatted = formatMoney(amount, currency);
  const match = formatted.match(/^([^0-9-]*)(-?\d[\d,]*)([.,]\d+)?(.*)$/);

  if (!match) {
    return (
      <AppText
        className={cn("text-[44px] font-bold tracking-tighter tabular-nums", className)}
        style={{ color: colors.ink }}
      >
        {formatted}
      </AppText>
    );
  }

  const [, prefix, whole, fraction, suffix] = match;

  return (
    <View className={cn("flex-row items-baseline", className)}>
      {prefix ? (
        <AppText className="mr-0.5 text-[22px] font-semibold" style={{ color: colors.muted }}>
          {prefix}
        </AppText>
      ) : null}
      <AppText
        className="text-[44px] font-bold tracking-tighter tabular-nums"
        style={{ color: colors.ink }}
      >
        {whole}
      </AppText>
      {fraction ? (
        <AppText className="text-[22px] font-semibold tabular-nums" style={{ color: colors.muted }}>
          {fraction}
        </AppText>
      ) : null}
      {suffix ? (
        <AppText className="ml-1 text-[16px] font-medium" style={{ color: colors.muted }}>
          {suffix}
        </AppText>
      ) : null}
    </View>
  );
}
