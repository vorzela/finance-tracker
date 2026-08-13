/**
 * components/ui/input.tsx
 *
 * Modern, Apple-inspired text input with label embedded inside the container.
 * Includes hint, error/success states, leading/trailing nodes, and a
 * password variant with a show/hide toggle.
 */

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/lib/theme";
import {
    CheckCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    WarningCircleIcon,
} from "phosphor-react-native";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
    Pressable,
    Text,
    TextInput,
    View,
    type TextInputProps,
} from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

// Maps discrete state to a number on a shared animation range [0, 3]
function colorMode(
  error?: string,
  success?: string,
  isFocused?: boolean,
): number {
  if (error) return 3;
  if (success) return 2;
  if (isFocused) return 1;
  return 0;
}

function getBorderClasses(
  error?: string,
  success?: string,
  isFocused?: boolean,
) {
  if (error) return "border-red-400 bg-red-50";
  if (success) return "border-green-400 bg-green-50";
  if (isFocused) return "border-navy-400 bg-white";
  return "border-gray-200/60 bg-gray-50";
}

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  leadingNode?: React.ReactNode;
  trailingNode?: React.ReactNode;
  wrapClassName?: string;
}

/**
 * NativeWind v5 / react-native-css crashes TextInput when `text-center|left|right`
 * land in className (`path.split` on a boolean mapping). Strip those utilities and
 * apply textAlign via style instead.
 */
const TEXT_ALIGN_RE = /\btext-(left|center|right|justify)\b/g;

function splitTextAlignClass(className?: string): {
  className?: string;
  textAlign?: "left" | "center" | "right" | "justify";
} {
  if (!className) return {};
  let textAlign: "left" | "center" | "right" | "justify" | undefined;
  const cleaned = className
    .replace(TEXT_ALIGN_RE, (match, align: string) => {
      textAlign = align as "left" | "center" | "right" | "justify";
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { className: cleaned || undefined, textAlign };
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      hint,
      error,
      success,
      required,
      leadingNode,
      trailingNode,
      wrapClassName,
      className,
      style,
      onFocus,
      onBlur,
      onChangeText,
      secureTextEntry,
      value,
      defaultValue,
      ...rest
    },
    ref,
  ) => {
    const colors = useThemeColors();
    const palette = useMemo(
      () =>
        [
          colors.muted,
          colors.brand,
          colors.positive,
          colors.negative,
        ] as const,
      [colors.muted, colors.brand, colors.positive, colors.negative],
    );

    const [isFocused, setIsFocused] = useState(false);
    const { className: safeClassName, textAlign } = splitTextAlignClass(className);

    // Track internal value so uncontrolled inputs still animate the label correctly
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");

    // isActive when focused OR when the field has any content
    const isActive = isFocused || !!(value ?? internalValue);

    // Internal ref so the Pressable container can call .focus() without
    // relying on the consumer's ref, which may be null.
    const internalRef = useRef<TextInput>(null);
    const mergeRef = (node: TextInput | null) => {
      (internalRef as React.RefObject<TextInput | null>).current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.RefObject<TextInput | null>).current = node;
      }
    };

    // ── Label size + translateY animation ────────────────────────────────────
    // Inactive: fontSize=12, translateY=8  (label sits lower, appears centred)
    // Active:   fontSize=11, translateY=0  (label floats up, makes room for text)
    const labelSize = useSharedValue(isActive ? 11 : 12);
    const labelY    = useSharedValue(isActive ? 0 : 8);

    useEffect(() => {
      const cfg = { duration: 180 };
      labelSize.value = withTiming(isActive ? 11 : 12, cfg);
      labelY.value    = withTiming(isActive ? 0 : 8,   cfg);
    }, [isActive]);

    // ── Label color animation ─────────────────────────────────────────────────
    const cm = useSharedValue(colorMode(error, success, isFocused));

    useEffect(() => {
      cm.value = withTiming(colorMode(error, success, isFocused), { duration: 150 });
    }, [error, success, isFocused]);

    const labelAnimStyle = useAnimatedStyle(() => ({
      fontSize:  labelSize.value,
      transform: [{ translateY: labelY.value }],
      color: interpolateColor(
        cm.value,
        [0, 1, 2, 3],
        [palette[0], palette[1], palette[2], palette[3]],
      ),
    }));

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChangeText = (text: string) => {
      setInternalValue(text);
      onChangeText?.(text);
    };

    return (
      <View className={cn("w-full gap-1.5", wrapClassName)}>
        {/* Tapping anywhere in the container (label, padding) focuses the input */}
        <Pressable
          onPress={() => internalRef.current?.focus()}
          className={cn(
            "flex-row items-center rounded-2xl border px-4 min-h-15",
            getBorderClasses(error, success, isFocused),
          )}
          style={
            isFocused && !error && !success
              ? { borderColor: colors.brand }
              : undefined
          }
        >
          {leadingNode && <View className="mr-3">{leadingNode}</View>}

          {/* Label + TextInput column */}
          <View className="flex-1 justify-center py-2 min-h-10">
            {label && (
              <Animated.Text style={labelAnimStyle} className="font-bold tracking-wider mb-0.5">
                {label}
                {required && <Text className="text-red-500"> *</Text>}
              </Animated.Text>
            )}
            <TextInput
              ref={mergeRef}
              className={cn(
                "text-base text-gray-900 p-0 m-0",
                label && "mt-0.5",
                safeClassName,
              )}
              style={[textAlign ? { textAlign } : null, style]}
              placeholderTextColor="#9ca3af"
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChangeText={handleChangeText}
              secureTextEntry={secureTextEntry}
              value={value}
              defaultValue={defaultValue}
              {...rest}
            />
          </View>

          {/* Trailing node + validation icons */}
          <View className="flex-row items-center gap-2 ml-3">
            {trailingNode}
            {error && (
              <WarningCircleIcon size={20} color="#f85252" weight="fill" />
            )}
            {!error && success && (
              <CheckCircleIcon size={20} color="#3db077" weight="fill" />
            )}
          </View>
        </Pressable>

        {/* Hint / error / success text */}
        {(hint || error || success) && (
          <Text
            className={cn(
              "text-sm px-2",
              error
                ? "text-red-500"
                : success
                  ? "text-green-600"
                  : "text-gray-500",
            )}
          >
            {error || success || hint}
          </Text>
        )}
      </View>
    );
  },
);

Input.displayName = "Input";

// ── Password variant ──────────────────────────────────────────────────────────

export function PasswordInput(
  props: Omit<InputProps, "secureTextEntry" | "trailingNode">,
) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      trailingNode={
        <Pressable
          // stopPropagation prevents the outer container Pressable from also
          // firing and stealing focus when the user taps the eye toggle
          onPress={(e) => {
            e.stopPropagation();
            setVisible((v) => !v);
          }}
          className="p-1 opacity-80 active:opacity-100"
          hitSlop={8}
        >
          {visible ? (
            <EyeIcon size={22} color="#6b7280" />
          ) : (
            <EyeSlashIcon size={22} color="#6b7280" />
          )}
        </Pressable>
      }
    />
  );
}
