/**
 * components/finance/money.tsx
 *
 * Amount text. Colour carries the direction — green for money in, navy for
 * money out, gray for internal transfers — so rows don't need a second cue.
 */

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/currency";
import React from "react";
import { Text, View } from "react-native";
import type { TransactionKind } from "@/types/database";

const SIZES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
  hero: "text-5xl",
} as const;

export interface MoneyProps {
  /** Minor units. */
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  kind?: TransactionKind;
  /** Prefix with + / −. Defaults on when `kind` is given. */
  showSign?: boolean;
  /** Drops the decimals. */
  compact?: boolean;
  className?: string;
  muted?: boolean;
}

function colourFor(kind: TransactionKind | undefined, muted: boolean): string {
  if (muted) return "text-gray-400";
  if (kind === "income") return "text-green-500";
  if (kind === "transfer") return "text-gray-500";
  return "text-gray-900";
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
  const signed = showSign ?? Boolean(kind);
  const value = kind === "expense" ? -Math.abs(amount) : amount;

  return (
    <Text
      className={cn(
        "font-bold tracking-tight tabular-nums",
        SIZES[size],
        colourFor(kind, muted),
        className,
      )}
      numberOfLines={1}
    >
      {formatMoney(signed ? value : amount, currency, { showSign: signed, compact })}
    </Text>
  );
}

/**
 * The big number on the dashboard: symbol and decimals shrink so the digits
 * stay dominant.
 */
export function MoneyHero({
  amount,
  currency,
  className,
}: {
  amount: number;
  currency: string;
  className?: string;
}) {
  const formatted = formatMoney(amount, currency);
  const match = /^([^\d-]*)(-?[\d,\s.]*?)([.,]\d+)?$/.exec(formatted);
  const symbol = match?.[1] ?? "";
  const whole = match?.[2] ?? formatted;
  const fraction = match?.[3] ?? "";

  return (
    <View className={cn("flex-row items-start", className)}>
      {symbol ? (
        <Text className="mt-2 text-xl font-bold tracking-tight text-white/70">{symbol}</Text>
      ) : null}
      <Text className="text-5xl font-bold tracking-tighter tabular-nums text-white">
        {whole}
      </Text>
      {fraction ? (
        <Text className="mt-2.5 text-xl font-bold tracking-tight text-white/70">
          {fraction}
        </Text>
      ) : null}
    </View>
  );
}
