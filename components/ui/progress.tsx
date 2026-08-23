/**
 * components/ui/progress.tsx
 *
 * Soft track + rounded fill — Material progress language.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ProgressBarProps {
  ratio: number;
  color?: string;
  height?: number;
  trackClassName?: string;
  className?: string;
}

export function ProgressBar({
  ratio,
  color,
  height = 6,
  trackClassName,
  className,
}: ProgressBarProps) {
  const colors = useThemeColors();
  const fillColor = color ?? colors.brand;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 480 });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      className={cn("overflow-hidden rounded-full bg-subtle", trackClassName, className)}
      style={{ height }}
    >
      <Animated.View
        style={[fillStyle, { backgroundColor: fillColor, height }]}
        className="rounded-full"
      />
    </View>
  );
}

export function StackedBar({
  segments,
  height = 8,
  className,
}: {
  segments: { key: string; share: number; color: string }[];
  height?: number;
  className?: string;
}) {
  const visible = segments.filter((segment) => segment.share > 0);

  return (
    <View
      className={cn("flex-row overflow-hidden rounded-full bg-subtle", className)}
      style={{ height }}
    >
      {visible.map((segment, index) => (
        <View
          key={segment.key}
          style={{
            flex: segment.share,
            backgroundColor: segment.color,
            marginLeft: index === 0 ? 0 : 1.5,
          }}
        />
      ))}
    </View>
  );
}
