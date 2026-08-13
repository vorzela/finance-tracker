/**
 * components/ui/button.tsx
 *
 * Primary buttons follow the active accent from Settings → Colour theme
 * (not a hardcoded navy). Icons on primary/secondary are tinted to match.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
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
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  haptic?: HapticStyle;
  onLongPress?: PressableProps["onLongPress"];
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
  }
> = {
  primary: {
    solid: "",
    outline: "bg-transparent border",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-brand",
    ghostText: "text-brand",
  },
  secondary: {
    solid: "bg-gray-100",
    outline: "bg-transparent border border-gray-300",
    ghost: "bg-transparent border border-transparent",
    text: "text-gray-900",
    outlineText: "text-gray-700",
    ghostText: "text-gray-600",
  },
  danger: {
    solid: "bg-red-500",
    outline: "bg-transparent border border-red-500",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-red-500",
    ghostText: "text-red-500",
  },
  success: {
    solid: "bg-green-500",
    outline: "bg-transparent border border-green-500",
    ghost: "bg-transparent border border-transparent",
    text: "text-white",
    outlineText: "text-green-500",
    ghostText: "text-green-500",
  },
  ghost: {
    solid: "bg-transparent",
    outline: "bg-transparent border border-transparent",
    ghost: "bg-transparent border border-transparent",
    text: "text-gray-900",
    outlineText: "text-gray-900",
    ghostText: "text-gray-900",
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

function tintIcon(node: React.ReactNode, color: string): React.ReactNode {
  if (!React.isValidElement(node)) return node;
  return React.cloneElement(node as React.ReactElement<{ color?: string }>, {
    color,
  });
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
    const colors = useThemeColors();
    const isDisabled = disabled || loading;
    const isGhost = variant === "ghost";
    const pressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDisabledRef = useRef(isDisabled);
    const isDisabledShared = useSharedValue(isDisabled);
    const isPressed = useSharedValue(false);

    useEffect(() => {
      isDisabledRef.current = isDisabled;
      isDisabledShared.value = isDisabled;
    }, [isDisabled]);

    useEffect(() => {
      return () => {
        if (pressTimeout.current) clearTimeout(pressTimeout.current);
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

    const brandStyle: ViewStyle | undefined =
      variant === "primary"
        ? outline || isGhost
          ? { borderColor: colors.brand }
          : { backgroundColor: colors.brand }
        : undefined;

    const loadingColor =
      variant === "primary"
        ? outline || isGhost
          ? colors.brand
          : colors.onBrand
        : variant === "danger"
          ? outline || isGhost
            ? colors.negative
            : "#ffffff"
          : variant === "success"
            ? outline || isGhost
              ? colors.positive
              : "#ffffff"
            : outline || isGhost
              ? "#374151"
              : "#111827";

    const iconColor =
      variant === "primary"
        ? outline || isGhost
          ? colors.brand
          : colors.onBrand
        : variant === "secondary"
          ? colors.brand
          : undefined;

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
        { duration: 100 },
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
        style={[brandStyle, style]}
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
          ) : iconColor ? (
            tintIcon(icon, iconColor)
          ) : (
            icon
          )}

          {typeof children === "string" ? (
            <Text
              className={cn(sizeStyle.text, textColorStyle, textClassName)}
              style={
                variant === "primary" && (outline || isGhost)
                  ? { color: colors.brand }
                  : undefined
              }
            >
              {children}
            </Text>
          ) : (
            children
          )}

          {!loading &&
            (iconColor ? tintIcon(trailingIcon, iconColor) : trailingIcon)}
        </Animated.View>
      </Pressable>
    );
  },
);

Button.displayName = "Button";
