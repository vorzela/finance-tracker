/**
 * components/ui/checkbox.tsx
 *
 * Apple-inspired checkbox — fully custom visual, no expo-checkbox in the render.
 * • SVG checkmark draws in via strokeDashoffset on check
 * • Box background + border animate via interpolateColor
 * • Press feedback: spring scale squeeze
 * • Error state: red tint + border + warning dot
 */

import { cn } from "@/lib/cn";
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

// ── Animated SVG path for the checkmark draw-in effect ───────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Approx total length of "M 2 6.5 L 5 9.5 L 10.5 3" in a 12×12 viewBox
// Segment 1: √((5-2)²+(9.5-6.5)²) ≈ 4.24  |  Segment 2: √((10.5-5)²+(3-9.5)²) ≈ 8.51
const TICK_LENGTH = 13;

// ── Color tokens (mirror global.css) ─────────────────────────────────────────
const C = {
  uncheckedBg: "#ffffff",
  uncheckedBorder: "#d1d5db", // gray-300
  checkedBg: "#1e3a5f", // navy-600
  checkedBorder: "#1e3a5f",
  errorBg: "#fff1f1", // red-50
  errorBorder: "#f85252", // red-400
  errorDot: "#e02020", // red-500
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  error,
  disabled = false,
  className,
}: CheckboxProps) {
  // State index: 0 = unchecked, 1 = checked, 2 = error (unchecked)
  // When checked + error we still show checked visually (box wins over error bg)
  const boxState = useSharedValue(checked ? 1 : error ? 2 : 0);

  useEffect(() => {
    boxState.value = withTiming(checked ? 1 : error ? 2 : 0, { duration: 180 });
  }, [checked, error]);

  // Box background
  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      boxState.value,
      [0, 1, 2],
      [C.uncheckedBg, C.checkedBg, C.errorBg],
    ),
    borderColor: interpolateColor(
      boxState.value,
      [0, 1, 2],
      [C.uncheckedBorder, C.checkedBorder, C.errorBorder],
    ),
  }));

  // Checkmark draw-in: dashOffset goes TICK_LENGTH → 0 when checked
  const dashOffset = useSharedValue(checked ? 0 : TICK_LENGTH);
  useEffect(() => {
    dashOffset.value = checked
      ? withTiming(0, { duration: 220 })
      : withTiming(TICK_LENGTH, { duration: 120 });
  }, [checked]);

  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // Error indicator dot opacity (only visible when error + unchecked)
  const errorDotOpacity = useSharedValue(!checked && !!error ? 1 : 0);
  useEffect(() => {
    errorDotOpacity.value = withTiming(!checked && !!error ? 1 : 0, {
      duration: 160,
    });
  }, [checked, error]);
  const errorDotStyle = useAnimatedStyle(() => ({
    opacity: errorDotOpacity.value,
  }));

  // Press scale feedback
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      onPressIn={() => {
        if (!disabled)
          scale.value = withSpring(0.88, { damping: 14, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      disabled={disabled}
      className={cn(
        "flex-row items-start gap-3",
        disabled && "opacity-80",
        className,
      )}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      {/* ── Box ────────────────────────────────────────────────────────────── */}
      <Animated.View style={scaleStyle} className="mt-0.5">
        <Animated.View
          style={boxStyle}
          className="w-6 h-6 rounded-lg border-[1.5px] items-center justify-center overflow-hidden"
        >
          {/* Checkmark SVG */}
          <Svg width={14} height={14} viewBox="0 0 12 12">
            <AnimatedPath
              d="M 2 6.5 L 5 9.5 L 10.5 3"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={TICK_LENGTH}
              animatedProps={tickProps}
            />
          </Svg>

          {/* Error dot — small red circle when unchecked + error */}
          <Animated.View
            style={[errorDotStyle, { position: "absolute" }]}
            className="w-2 h-2 rounded-full bg-red-500"
          />
        </Animated.View>
      </Animated.View>

      {/* ── Label / hint / error text ───────────────────────────────────────── */}
      {(label || hint || error) && (
        <View className="flex-1 gap-0.5 pt-0.5">
          {label && (
            <Text
              className={cn(
                "text-base text-gray-900 leading-snug",
                disabled && "text-gray-400",
              )}
            >
              {label}
            </Text>
          )}
          {error ? (
            <Text className="text-[12px] text-red-500 leading-snug">
              {error}
            </Text>
          ) : hint ? (
            <Text className="text-[12px] text-gray-400 leading-snug">
              {hint}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

// ── CheckboxGroup ─────────────────────────────────────────────────────────────
export interface CheckboxGroupProps {
  label?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function CheckboxGroup({
  label,
  error,
  className,
  children,
}: CheckboxGroupProps) {
  return (
    <View className={cn("gap-3", className)}>
      {label && (
        <Text className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </Text>
      )}
      {children}
      {error && <Text className="text-sm text-red-500 px-1">{error}</Text>}
    </View>
  );
}
