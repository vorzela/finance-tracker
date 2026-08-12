/**
 * components/ui/progress.tsx
 *
 * Budget bars. The fill animates from wherever it was so a refetch nudges the
 * bar rather than snapping it, and over-budget bars clamp at full width while
 * the label keeps telling the truth.
 */

import { cn } from "@/lib/cn";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ProgressBarProps {
  /** 0–1, values above 1 are clamped for the fill only. */
  ratio: number;
  color?: string;
  /** Height in pixels. */
  height?: number;
  trackClassName?: string;
  className?: string;
}

export function ProgressBar({
  ratio,
  color = "#1e3a5f",
  height = 8,
  trackClassName,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 420 });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      className={cn("overflow-hidden rounded-full bg-gray-100", trackClassName, className)}
      style={{ height }}
    >
      <Animated.View style={[fillStyle, { backgroundColor: color, height }]} className="rounded-full" />
    </View>
  );
}

/**
 * Stacked segments of one bar — used for the shared ledger's per-person split,
 * where the parts add up to the month's spend.
 */
export function StackedBar({
  segments,
  height = 10,
  className,
}: {
  segments: { key: string; share: number; color: string }[];
  height?: number;
  className?: string;
}) {
  const visible = segments.filter((segment) => segment.share > 0);

  return (
    <View
      className={cn("flex-row overflow-hidden rounded-full bg-gray-100", className)}
      style={{ height }}
    >
      {visible.map((segment, index) => (
        <View
          key={segment.key}
          style={{
            flex: segment.share,
            backgroundColor: segment.color,
            marginLeft: index === 0 ? 0 : 2,
          }}
        />
      ))}
    </View>
  );
}
