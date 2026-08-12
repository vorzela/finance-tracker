/**
 * components/finance/charts.tsx
 *
 * The two charts the app needs, hand-drawn with react-native-svg rather than a
 * charting library: a donut for where the money went, and bars for how the
 * months compare.
 */

import { formatCompactNumber } from "@/lib/currency";
import { shortMonthLabel } from "@/lib/date";
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import type { CategorySummary, DayPoint, MonthPoint } from "@/types/finance";

// ── Donut ───────────────────────────────────────────────────────────────────

export interface DonutProps {
  slices: { key: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  /** Rendered in the hole. */
  children?: React.ReactNode;
}

/**
 * Drawn as stroked arc segments on one circle: `strokeDasharray` sets a
 * segment's length and `strokeDashoffset` rotates it into place, which avoids
 * building wedge paths by hand.
 */
export function Donut({ slices, size = 168, thickness = 22, children }: DonutProps) {
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
            stroke="#f3f4f6"
            strokeWidth={thickness}
            fill="none"
          />
          {total > 0 &&
            slices.map((slice) => {
              const share = slice.value / total;
              // A 1.5% floor keeps tiny slices visible instead of vanishing.
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

/** Colour key beneath the donut. */
export function DonutLegend({
  categories,
  currency,
  max = 5,
}: {
  categories: CategorySummary[];
  currency: string;
  max?: number;
}) {
  const shown = categories.slice(0, max);

  return (
    <View className="flex-1 gap-2.5">
      {shown.map((category) => (
        <View key={category.categoryId} className="flex-row items-center gap-2.5">
          <View
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <Text className="flex-1 text-sm font-medium text-gray-700" numberOfLines={1}>
            {category.label}
          </Text>
          <Text className="text-sm font-bold tabular-nums text-gray-900">
            {Math.round(category.share * 100)}%
          </Text>
        </View>
      ))}
      {categories.length > max ? (
        <Text className="text-xs text-gray-400">
          +{categories.length - max} more{" "}
          {formatCompactNumber(
            categories.slice(max).reduce((sum, category) => sum + category.total, 0),
            currency,
          )}
        </Text>
      ) : null}
    </View>
  );
}

// ── Month bars ──────────────────────────────────────────────────────────────

export interface MonthBarsProps {
  points: MonthPoint[];
  currency: string;
  height?: number;
  /** Highlighted month, drawn in navy while the rest stay pale. */
  activeMonthKey?: string;
}

export function MonthBars({
  points,
  currency,
  height = 140,
  activeMonthKey,
}: MonthBarsProps) {
  const peak = Math.max(...points.map((point) => point.spent), 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between" style={{ height }}>
        {points.map((point) => {
          const ratio = point.spent / peak;
          const isActive = point.monthKey === activeMonthKey;

          return (
            <View key={point.monthKey} className="flex-1 items-center gap-1.5">
              <Text
                className="text-[10px] font-semibold tabular-nums text-gray-400"
                numberOfLines={1}
              >
                {point.spent > 0 ? formatCompactNumber(point.spent, currency) : ""}
              </Text>
              <View
                className="w-full max-w-9 rounded-t-lg"
                style={{
                  height: Math.max(4, ratio * (height - 26)),
                  backgroundColor: isActive ? "#1e3a5f" : "#d4dff0",
                }}
              />
            </View>
          );
        })}
      </View>

      <View className="flex-row justify-between">
        {points.map((point) => (
          <Text
            key={point.monthKey}
            className="flex-1 text-center text-[10px] font-medium text-gray-400"
            numberOfLines={1}
          >
            {shortMonthLabel(point.monthKey).split(" ")[0]}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Cumulative spend line ───────────────────────────────────────────────────

export interface SpendLineProps {
  days: DayPoint[];
  /** Draws a dashed guide, usually the month's budget. */
  target?: number;
  height?: number;
  width?: number;
}

/**
 * Running total across the month. A straight line means steady spending; a
 * cliff means a big day.
 */
export function SpendLine({ days, target, height = 96, width = 320 }: SpendLineProps) {
  if (days.length === 0) return null;

  const peak = Math.max(
    days[days.length - 1]?.cumulative ?? 0,
    target ?? 0,
    1,
  );
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
      <Path d={area} fill="#1e3a5f" fillOpacity={0.08} />
      <Path
        d={line}
        stroke="#1e3a5f"
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
          fill="#f59e0b"
          opacity={0.7}
        />
      ) : null}
    </Svg>
  );
}
