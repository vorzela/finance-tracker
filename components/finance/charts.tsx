/**
 * components/finance/charts.tsx
 *
 * Donut, month bars and spend line — colours follow the active theme.
 */

import { formatCompactNumber } from "@/lib/currency";
import { shortMonthLabel } from "@/lib/date";
import { useThemeColors } from "@/lib/theme";
import React from "react";
import { AppText } from "@/components/ui/app-text";
import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import type { CategorySummary, DayPoint, MonthPoint } from "@/types/finance";

export interface DonutProps {
  slices: { key: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}

export function Donut({ slices, size = 168, thickness = 22, children }: DonutProps) {
  const colors = useThemeColors();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  let consumed = 0;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.subtle}
            strokeWidth={thickness}
            fill="none"
          />
          {total > 0 &&
            slices.map((slice) => {
              const share = slice.value / total;
              const length = Math.max(share, 0.015) * circumference;
              const offset = consumed * circumference;
              consumed += share;

              return (
                <Circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
        </G>
      </Svg>
      {children}
    </View>
  );
}

export function DonutLegend({
  categories,
  currency,
  max = 5,
}: {
  categories: CategorySummary[];
  currency: string;
  max?: number;
}) {
  const colors = useThemeColors();
  const shown = categories.slice(0, max);

  return (
    <View className="flex-1 gap-2.5">
      {shown.map((category) => (
        <View key={category.categoryId} className="flex-row items-center gap-2.5">
          <View
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <AppText
            className="flex-1 text-[13px] font-medium"
            style={{ color: colors.ink }}
            numberOfLines={1}
          >
            {category.label}
          </AppText>
          <AppText
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: colors.muted }}
          >
            {Math.round(category.share * 100)}%
          </AppText>
        </View>
      ))}
      {categories.length > max ? (
        <AppText className="text-[12px]" style={{ color: colors.faint }}>
          +{categories.length - max} more{" "}
          {formatCompactNumber(
            categories.slice(max).reduce((sum, category) => sum + category.total, 0),
            currency,
          )}
        </AppText>
      ) : null}
    </View>
  );
}

export interface MonthBarsProps {
  points: MonthPoint[];
  currency: string;
  height?: number;
  activeMonthKey?: string;
}

export function MonthBars({
  points,
  currency,
  height = 140,
  activeMonthKey,
}: MonthBarsProps) {
  const colors = useThemeColors();
  const peak = Math.max(...points.map((point) => point.spent), 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between" style={{ height }}>
        {points.map((point) => {
          const ratio = point.spent / peak;
          const isActive = point.monthKey === activeMonthKey;

          return (
            <View key={point.monthKey} className="flex-1 items-center gap-1.5">
              <AppText
                className="text-[10px] font-semibold tabular-nums"
                style={{ color: colors.faint }}
                numberOfLines={1}
              >
                {point.spent > 0 ? formatCompactNumber(point.spent, currency) : ""}
              </AppText>
              <View
                className="w-full max-w-9 rounded-t-lg"
                style={{
                  height: Math.max(4, ratio * (height - 26)),
                  backgroundColor: isActive ? colors.brand : colors.brandSoft,
                }}
              />
            </View>
          );
        })}
      </View>

      <View className="flex-row justify-between">
        {points.map((point) => (
          <AppText
            key={point.monthKey}
            className="flex-1 text-center text-[10px] font-medium"
            style={{ color: colors.muted }}
            numberOfLines={1}
          >
            {shortMonthLabel(point.monthKey).split(" ")[0]}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export interface SpendLineProps {
  days: DayPoint[];
  target?: number;
  height?: number;
  width?: number;
}

export function SpendLine({ days, target, height = 96, width = 320 }: SpendLineProps) {
  const colors = useThemeColors();
  if (days.length === 0) return null;

  const peak = Math.max(days[days.length - 1]?.cumulative ?? 0, target ?? 0, 1);
  const stepX = width / Math.max(1, days.length - 1);

  const points = days.map((day, index) => ({
    x: index * stepX,
    y: height - (day.cumulative / peak) * height,
  }));

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const targetY = target ? height - (target / peak) * height : null;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={area} fill={colors.brand} fillOpacity={0.1} />
      <Path
        d={line}
        stroke={colors.brand}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {targetY !== null ? (
        <Rect
          x={0}
          y={Math.max(0, targetY)}
          width={width}
          height={1.5}
          fill={colors.warn}
          opacity={0.75}
        />
      ) : null}
    </Svg>
  );
}
