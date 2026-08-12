/**
 * components/ui/segmented.tsx
 *
 * iOS-style segmented control. The white thumb slides on the UI thread, and the
 * track width comes from `onLayout` so segments always divide evenly.
 */

import { cn } from "@/lib/cn";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
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
  /** Tints the thumb, for the expense/income switch. */
  thumbColor?: string;
  size?: "sm" | "md";
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  thumbColor = "#ffffff",
  size = "md",
}: SegmentedProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = trackWidth === 0 ? 0 : trackWidth / options.length;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }));

  // Driven by the selected index rather than the tap, so the thumb also follows
  // changes made elsewhere.
  useEffect(() => {
    if (segmentWidth === 0) return;
    const target = segmentWidth * index;
    if (offset.value === 0 && index === 0) offset.value = 0;
    else offset.value = withTiming(target, { duration: 180 });
  }, [index, segmentWidth, offset]);

  const select = (option: SegmentOption<T>) => {
    void Haptics.selectionAsync().catch(() => {});
    onChange(option.value);
  };

  return (
    <View
      onLayout={onLayout}
      className={cn(
        "relative flex-row rounded-2xl bg-gray-100 p-1",
        size === "sm" ? "h-10" : "h-12",
        className,
      )}
    >
      <Animated.View
        style={[thumbStyle, { backgroundColor: thumbColor }]}
        className="absolute bottom-1 left-1 top-1 rounded-xl shadow-sm"
      />

      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => select(option)}
            className="flex-1 items-center justify-center"
          >
            <Text
              className={cn(
                "text-sm font-semibold tracking-tight",
                isActive ? "text-gray-900" : "text-gray-500",
              )}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
