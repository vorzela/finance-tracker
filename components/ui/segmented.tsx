/**
 * components/ui/segmented.tsx
 *
 * iOS-style segmented control with a sliding thumb.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  thumbColor?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  thumbColor,
  size = "md",
}: SegmentedProps<T>) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = trackWidth === 0 ? 0 : trackWidth / options.length;
  const fill = thumbColor ?? colors.surface;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }));

  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = segmentWidth * index;
    offset.value = withTiming(target, { duration: 200 });
  }, [index, segmentWidth, offset]);

  return (
    <View
      onLayout={onLayout}
      className={cn(
        "relative flex-row rounded-full bg-subtle p-1",
        size === "sm" ? "h-9" : "h-11",
        className,
      )}
    >
      <Animated.View
        style={[
          thumbStyle,
          {
            backgroundColor: fill,
            shadowColor: colors.chrome,
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          },
        ]}
        className="absolute bottom-1 left-1 top-1 rounded-full"
      />

      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            className="will-change-pressable flex-1 items-center justify-center"
          >
            <AppText
              className={cn(
                "text-[13px] font-semibold tracking-tight",
                isActive ? "text-ink" : "text-muted",
              )}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
