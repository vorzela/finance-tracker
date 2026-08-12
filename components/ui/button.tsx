/**
 * components/ui/button.tsx
 *
 * Premium, Apple-inspired button component with smooth animations, haptic feedback,
 * and advanced gesture support using React Native Reanimated.
 *
 * Features:
 * - 5 color variants: primary (navy), secondary, ghost, danger (red), success (green)
 * - 3 sizes: sm (h-10), md (h-12), lg (h-14)
 * - 2 modes: solid (filled) and outline
 * - Smooth 100ms opacity fade-on-press using Reanimated (runs on UI thread)
 * - Configurable haptic feedback: light, medium, heavy, or none
 * - Double-tap detection with 300ms debounce window
 * - Long-press support with heavy haptics
 * - Loading state with animated ActivityIndicator
 * - Icon support (leading and trailing)
 * - Automatic disabled state during loading
 * - Full ref forwarding support
 *
 * Usage Examples:
 *
 * Basic primary button:
 *   <Button onPress={() => alert('Pressed!')}>
 *     Click me
 *   </Button>
 *
 * Outline variant with icon:
 *   <Button variant="secondary" outline icon={<EditIcon size={20} />}>
 *     Edit Profile
 *   </Button>
 *
 * Danger button with loading state:
 *   <Button
 *     variant="danger"
 *     loading={isDeleting}
 *     onPress={() => handleDelete()}
 *   >
 *     Delete Account
 *   </Button>
 *
 * Success button with trailing icon:
 *   <Button
 *     variant="success"
 *     size="lg"
 *     trailingIcon={<CheckIcon size={20} color="#fff" />}
 *   >
 *     Confirm
 *   </Button>
 *
 * Button with double-tap and long-press:
 *   <Button
 *     haptic="medium"
 *     onPress={() => console.log('Single tap')}
 *     onDoublePress={() => console.log('Double tap')}
 *     onLongPress={() => console.log('Long press')}
 *   >
 *     Multi-gesture
 *   </Button>
 *
 * Ghost variant (minimal styling):
 *   <Button variant="ghost" size="sm">
 *     Dismiss
 *   </Button>
 *
 * Custom styling and disabled state:
 *   <Button
 *     disabled={!isReady}
 *     className="border-2 border-dashed"
 *     textClassName="font-bold text-red-600"
 *   >
 *     Submit
 *   </Button>
 */

import { cn } from "@/lib/cn";
import * as Haptics from "expo-haptics";
import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type Size = "sm" | "md" | "lg";
export type HapticStyle = "light" | "medium" | "heavy" | "none";

export interface ButtonProps extends Omit<
  PressableProps,
  "style" | "className"
> {
  className?: string;
  textClassName?: string;
  variant?: Variant;
  size?: Size;
  outline?: boolean;
  loading?: boolean;
  /** Icon element placed before the label */
  icon?: React.ReactNode;
  /** Icon element placed after the label */
  trailingIcon?: React.ReactNode;
  haptic?: HapticStyle;
  /** Triggered on long press with medium/heavy haptics */
  onLongPress?: PressableProps["onLongPress"];
  /** Triggered on rapid successive taps */
  onDoublePress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

const variantStyles: Record<
  Variant,
  {
    solid: string;
    outline: string;
    ghost: string;
    text: string;
    outlineText: string;
    ghostText: string;
    loadingSolid: string;
    loadingOutline: string;
  }
> = {
  primary: {
    solid: "bg-navy-600",
    outline: "bg-transparent border border-navy-600",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-navy-600",
    ghostText: "text-navy-600",
    loadingSolid: "#ffffff",
    loadingOutline: "#1e3a5f", // navy-600
  },
  secondary: {
    solid: "bg-gray-100",
    outline: "bg-transparent border border-gray-300",
    ghost: "bg-transparent border border-transparent",
    text: "text-gray-900",
    outlineText: "text-gray-700",
    ghostText: "text-gray-600",
    loadingSolid: "#111827", // gray-900
    loadingOutline: "#374151", // gray-700
  },
  danger: {
    solid: "bg-red-500",
    outline: "bg-transparent border border-red-500",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-red-500",
    ghostText: "text-red-500",
    loadingSolid: "#ffffff",
    loadingOutline: "#e02020", // red-500
  },
  success: {
    solid: "bg-green-500",
    outline: "bg-transparent border border-green-500",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-green-500",
    ghostText: "text-green-500",
    loadingSolid: "#ffffff",
    loadingOutline: "#1f9155", // green-500
  },
  ghost: {
    solid: "bg-transparent",
    outline: "bg-transparent border border-transparent",
    ghost: "bg-transparent border border-transparent",
    text: "text-gray-900",
    outlineText: "text-gray-900",
    ghostText: "text-gray-900",
    loadingSolid: "#111827",
    loadingOutline: "#111827",
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: {
    container: "h-10 px-4 rounded-xl",
    text: "text-sm font-semibold tracking-tight",
  },
  md: {
    container: "h-12 px-6 rounded-2xl",
    text: "text-base font-semibold tracking-tight",
  },
  lg: {
    container: "h-14 px-8 rounded-[18px]",
    text: "text-lg font-semibold tracking-tight",
  },
};

const HAPTIC_MAP: Record<Exclude<HapticStyle, "none">, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

async function triggerHaptic(style: HapticStyle, isDisabled: boolean) {
  if (style === "none" || isDisabled) return;
  await HAPTIC_MAP[style]().catch(() => {});
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      outline = false,
      loading = false,
      disabled = false,
      icon,
      trailingIcon,
      haptic = "light",
      style,
      className,
      textClassName,
      children,
      onPress,
      onLongPress,
      onDoublePress,
      onPressIn,
      onPressOut,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const isGhost = variant === "ghost";
    const pressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDisabledRef = useRef(isDisabled);
    const isDisabledShared = useSharedValue(isDisabled);
    const isPressed = useSharedValue(false);

    // Sync disabled state
    useEffect(() => {
      isDisabledRef.current = isDisabled;
      isDisabledShared.value = isDisabled;
      // isDisabledShared is a stable Reanimated shared value — intentionally omitted
    }, [isDisabled]);

    // Cleanup on unmount only
    useEffect(() => {
      return () => {
        if (pressTimeout.current) {
          clearTimeout(pressTimeout.current);
        }
      };
    }, []);

    const modeKey = isGhost ? "ghost" : outline ? "outline" : "solid";
    const textModeKey = isGhost
      ? "ghostText"
      : outline
        ? "outlineText"
        : "text";

    const containerStyle = variantStyles[variant][modeKey];
    const textColorStyle = variantStyles[variant][textModeKey];
    const sizeStyle = sizeStyles[size];

    // Map correctly scaled spinner color
    const loadingColor =
      isGhost || outline
        ? variantStyles[variant].loadingOutline
        : variantStyles[variant].loadingSolid;

    const handlePress = useCallback(
      async (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
        if (isDisabled) return;

        if (onDoublePress) {
          if (pressTimeout.current) {
            clearTimeout(pressTimeout.current);
            pressTimeout.current = null;
            await triggerHaptic("medium", isDisabled);
            onDoublePress();
          } else {
            pressTimeout.current = setTimeout(async () => {
              pressTimeout.current = null;
              if (isDisabledRef.current) return;
              await triggerHaptic(haptic, isDisabledRef.current);
              onPress?.(e);
            }, 300);
          }
        } else {
          await triggerHaptic(haptic, isDisabled);
          onPress?.(e);
        }
      },
      [isDisabled, onDoublePress, onPress, haptic],
    );

    const handleLongPress = useCallback(
      async (e: Parameters<NonNullable<PressableProps["onLongPress"]>>[0]) => {
        if (isDisabled) return;
        await triggerHaptic(haptic === "none" ? "none" : "heavy", isDisabled);
        onLongPress?.(e);
      },
      [isDisabled, onLongPress, haptic],
    );

    const handlePressIn = useCallback(
      (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
        isPressed.value = true;
        onPressIn?.(e);
      },
      [onPressIn],
    );

    const handlePressOut = useCallback(
      (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
        isPressed.value = false;
        onPressOut?.(e);
      },
      [onPressOut],
    );

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: withTiming(
        isPressed.value && !isDisabledShared.value ? 0.6 : 1,
        {
          duration: 100,
        },
      ),
    }));

    return (
      <Pressable
        ref={ref}
        {...rest}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={style}
        className={cn(
          "items-center justify-center overflow-hidden flex-row",
          sizeStyle.container,
          containerStyle,
          isDisabled && "opacity-60",
          className,
        )}
      >
        <Animated.View
          style={animatedStyle}
          className="flex-row items-center justify-center gap-2"
        >
          {loading ? (
            <ActivityIndicator size="small" color={loadingColor} />
          ) : (
            icon
          )}

          {typeof children === "string" ? (
            <Text className={cn(sizeStyle.text, textColorStyle, textClassName)}>
              {children}
            </Text>
          ) : (
            children
          )}

          {!loading && trailingIcon}
        </Animated.View>
      </Pressable>
    );
  },
);

Button.displayName = "Button";
