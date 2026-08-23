/**
 * components/ui/shimmer.tsx
 *
 * Placeholder blocks that pulse while a screen's first payload is in flight.
 * Sized with NativeWind so each skeleton can match the card it stands in for.
 */

import { Card, Section } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export function Shimmer({
  className,
  style,
  circle = false,
}: {
  className?: string;
  style?: ViewStyle;
  circle?: boolean;
}) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.7;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("overflow-hidden", circle ? "rounded-full" : "rounded-xl", className)}
      style={style}
    >
      <Animated.View
        style={[{ flex: 1, minHeight: "100%", backgroundColor: colors.subtle }, animatedStyle]}
      />
    </View>
  );
}

export function RowsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <View className={cn("gap-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="flex-row items-center gap-3">
          <Shimmer circle className="h-11 w-11" />
          <View className="flex-1 gap-2">
            <Shimmer className="h-3.5 w-2/3" />
            <Shimmer className="h-3 w-1/3" />
          </View>
          <Shimmer className="h-4 w-16" />
        </Card>
      ))}
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View className="gap-5">
      <View className="overflow-hidden rounded-[26px]">
        <View className="bg-subtle p-[22px]">
          <View className="flex-row items-start justify-between">
            <Shimmer className="h-3.5 w-28" />
            <Shimmer className="h-8 w-28 rounded-full" />
          </View>
          <Shimmer className="mt-4 h-12 w-48" />
          <Shimmer className="mt-3 h-3.5 w-40" />
          <View className="mt-5 flex-row gap-3">
            <Shimmer className="h-[68px] flex-1 rounded-2xl" />
            <Shimmer className="h-[68px] flex-1 rounded-2xl" />
          </View>
        </View>
      </View>

      <Card>
        <Shimmer className="h-3 w-16" />
        <Shimmer className="mt-3 h-5 w-36" />
        <Shimmer className="mt-4 h-20 w-full rounded-2xl" />
        <Shimmer className="mt-3 h-3 w-2/3" />
      </Card>

      <Section title="Where it went">
        <Card>
          <View className="flex-row items-center gap-5">
            <Shimmer circle className="h-[132px] w-[132px]" />
            <View className="flex-1 gap-3">
              <Shimmer className="h-3.5 w-full" />
              <Shimmer className="h-3.5 w-5/6" />
              <Shimmer className="h-3.5 w-2/3" />
              <Shimmer className="h-3.5 w-1/2" />
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Recent">
        <Card flush>
          {Array.from({ length: 4 }, (_, index) => (
            <View
              key={index}
              className="flex-row items-center gap-3 px-5 py-3.5"
            >
              <Shimmer circle className="h-10 w-10" />
              <View className="flex-1 gap-2">
                <Shimmer className="h-3.5 w-2/3" />
                <Shimmer className="h-3 w-1/3" />
              </View>
              <Shimmer className="h-4 w-14" />
            </View>
          ))}
        </Card>
      </Section>
    </View>
  );
}

export function InsightsSkeleton() {
  return (
    <View className="gap-5">
      <Shimmer className="h-10 w-full rounded-full" />
      <Card>
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="mt-2 h-3.5 w-2/3" />
        <Shimmer className="mt-4 h-11 w-full rounded-2xl" />
      </Card>
      <Section title="Last 6 months">
        <Card>
          <Shimmer className="h-[140px] w-full rounded-2xl" />
          <View className="mt-4 flex-row gap-3">
            <Shimmer className="h-12 flex-1" />
            <Shimmer className="h-12 flex-1" />
          </View>
        </Card>
      </Section>
      <Section title="Categories">
        <RowsSkeleton count={4} className="gap-0" />
      </Section>
    </View>
  );
}

export function ActivitySkeleton() {
  return (
    <View className="gap-4">
      {Array.from({ length: 3 }, (_, section) => (
        <View key={section} className="gap-2">
          <View className="flex-row justify-between px-1">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-3 w-14" />
          </View>
          <Card flush>
            {Array.from({ length: 3 }, (_, row) => (
              <View
                key={row}
                className="flex-row items-center gap-3 px-5 py-3.5"
              >
                <Shimmer circle className="h-10 w-10" />
                <View className="flex-1 gap-2">
                  <Shimmer className="h-3.5 w-2/3" />
                  <Shimmer className="h-3 w-1/3" />
                </View>
                <Shimmer className="h-4 w-14" />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
