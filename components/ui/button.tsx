/**
 * components/ui/button.tsx
 *
 * Soft, full-bleed controls — filled primary, tonal secondary (Material You).
 */

import { AppText } from "@/components/ui/app-text";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import * as Haptics from "expo-haptics";
import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
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

export interface ButtonProps extends Omit<PressableProps, "style" | "className"> {
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

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: {
    container: "h-10 px-4 rounded-full",
    text: "text-[14px] font-semibold tracking-tight",
  },
  md: {
    container: "h-12 px-6 rounded-full",
    text: "text-[16px] font-semibold tracking-tight",
  },
  lg: {
    container: "h-[54px] px-7 rounded-full",
    text: "text-[17px] font-semibold tracking-tight",
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

function flattenLabel(children: React.ReactNode): string | null {
  if (children == null || typeof children === "boolean") return null;
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    const parts: string[] = [];
    for (const child of children) {
      if (child == null || typeof child === "boolean") continue;
      if (typeof child === "string" || typeof child === "number") {
        parts.push(String(child));
        continue;
      }
      return null;
    }
    return parts.length ? parts.join("") : null;
  }
  return null;
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

    const sizeStyle = sizeStyles[size];

    const containerStyle: ViewStyle = (() => {
      if (variant === "primary") {
        if (outline || isGhost) {
          return { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.brand };
        }
        return { backgroundColor: colors.brand };
      }
      if (variant === "secondary") {
        if (outline) {
          return {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.hairline,
          };
        }
        return { backgroundColor: colors.subtle };
      }
      if (variant === "danger") {
        if (outline || isGhost) {
          return {
            backgroundColor: "transparent",
            borderWidth: outline ? 1.5 : 0,
            borderColor: colors.negative,
          };
        }
        return { backgroundColor: colors.negative };
      }
      if (variant === "success") {
        if (outline || isGhost) {
          return {
            backgroundColor: "transparent",
            borderWidth: outline ? 1.5 : 0,
            borderColor: colors.positive,
          };
        }
        return { backgroundColor: colors.positive };
      }
      return { backgroundColor: "transparent" };
    })();

    const labelColor = (() => {
      if (variant === "primary") {
        return outline || isGhost ? colors.brand : colors.onBrand;
      }
      if (variant === "secondary") return colors.ink;
      if (variant === "danger") {
        return outline || isGhost ? colors.negative : colors.onBrand;
      }
      if (variant === "success") {
        return outline || isGhost ? colors.positive : colors.onBrand;
      }
      return colors.ink;
    })();

    const iconColor = labelColor;

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
      opacity: withTiming(isPressed.value && !isDisabledShared.value ? 0.72 : 1, {
        duration: 90,
      }),
      transform: [
        {
          scale: withTiming(isPressed.value && !isDisabledShared.value ? 0.98 : 1, {
            duration: 90,
          }),
        },
      ],
    }));

    const label = flattenLabel(children);

    return (
      <Pressable
        ref={ref}
        {...rest}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[containerStyle, style]}
        className={cn(
          "will-change-pressable items-center justify-center overflow-hidden flex-row",
          sizeStyle.container,
          isDisabled && "opacity-45",
          className,
        )}
      >
        <Animated.View
          style={animatedStyle}
          className="flex-row items-center justify-center gap-2"
        >
          {loading ? (
            <ActivityIndicator size="small" color={labelColor} />
          ) : (
            tintIcon(icon, iconColor)
          )}

          {label !== null ? (
            <AppText className={cn(sizeStyle.text, textClassName)} style={{ color: labelColor }}>
              {label}
            </AppText>
          ) : (
            children
          )}

          {!loading && tintIcon(trailingIcon, iconColor)}
        </Animated.View>
      </Pressable>
    );
  },
);

Button.displayName = "Button";
