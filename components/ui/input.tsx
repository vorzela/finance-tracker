/**
 * components/ui/input.tsx
 *
 * Filled tonal fields with floating labels — Material You / iOS Form polish.
 */

import { cn } from "@/lib/cn";
import { activeFontFamily } from "@/lib/font-runtime";
import { useAppearance, useThemeColors } from "@/lib/theme";
import { AppText } from "@/components/ui/app-text";
import {
    CheckCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    WarningCircleIcon,
} from "phosphor-react-native";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type TextInputProps
} from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

function colorMode(error?: string, success?: string, isFocused?: boolean): number {
  if (error) return 3;
  if (success) return 2;
  if (isFocused) return 1;
  return 0;
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
    const { font, italic } = useAppearance();
    const palette = useMemo(
      () => [colors.muted, colors.brand, colors.positive, colors.negative] as const,
      [colors.muted, colors.brand, colors.positive, colors.negative],
    );

    const [isFocused, setIsFocused] = useState(false);
    const { className: safeClassName, textAlign } = splitTextAlignClass(className);
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const isActive = isFocused || !!(value ?? internalValue);

    const internalRef = useRef<TextInput>(null);
    const mergeRef = (node: TextInput | null) => {
      (internalRef as React.RefObject<TextInput | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<TextInput | null>).current = node;
    };

    const labelSize = useSharedValue(isActive ? 11 : 13);
    const labelY = useSharedValue(isActive ? 0 : 7);

    useEffect(() => {
      const cfg = { duration: 160 };
      labelSize.value = withTiming(isActive ? 11 : 13, cfg);
      labelY.value = withTiming(isActive ? 0 : 7, cfg);
    }, [isActive]);

    const cm = useSharedValue(colorMode(error, success, isFocused));

    useEffect(() => {
      cm.value = withTiming(colorMode(error, success, isFocused), { duration: 140 });
    }, [error, success, isFocused]);

    const labelAnimStyle = useAnimatedStyle(() => ({
      fontSize: labelSize.value,
      transform: [{ translateY: labelY.value }],
      color: interpolateColor(cm.value, [0, 1, 2, 3], [...palette]),
      fontFamily: activeFontFamily({ fontWeight: "600" }),
    }));

    const fieldBg = error
      ? colors.negativeSoft
      : success
        ? colors.positiveSoft
        : isFocused
          ? colors.surface
          : colors.subtle;

    const fieldBorder = error
      ? colors.negative
      : success
        ? colors.positive
        : isFocused
          ? colors.brand
          : "transparent";

    return (
      <View className={cn("w-full gap-1.5", wrapClassName)}>
        <Pressable
          onPress={() => internalRef.current?.focus()}
          className="will-change-pressable min-h-[56px] flex-row items-center rounded-[16px] border-[1.5px] px-4"
          style={{ backgroundColor: fieldBg, borderColor: fieldBorder }}
        >
          {leadingNode ? <View className="mr-3">{leadingNode}</View> : null}

          <View className="min-h-11 flex-1 justify-center py-2">
            {label ? (
              <Animated.Text style={labelAnimStyle} className="mb-0.5 font-semibold tracking-wide">
                {label}
                {required ? <AppText style={{ color: colors.negative }}> *</AppText> : null}
              </Animated.Text>
            ) : null}
            <TextInput
              ref={mergeRef}
              className={cn("m-0 p-0 text-[17px] text-ink", label && "mt-0.5", safeClassName)}
              style={[
                {
                  color: colors.ink,
                  fontFamily: activeFontFamily({ fontWeight: "400" }),
                  fontWeight: "normal",
                },
                textAlign ? { textAlign } : null,
                style,
              ]}
              placeholderTextColor={colors.faint}
              onFocus={(e) => {
                setIsFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              onChangeText={(text) => {
                setInternalValue(text);
                onChangeText?.(text);
              }}
              secureTextEntry={secureTextEntry}
              value={value}
              defaultValue={defaultValue}
              {...rest}
            />
          </View>

          <View className="ml-3 flex-row items-center gap-2">
            {trailingNode}
            {error ? (
              <WarningCircleIcon size={20} color={colors.negative} weight="fill" />
            ) : null}
            {!error && success ? (
              <CheckCircleIcon size={20} color={colors.positive} weight="fill" />
            ) : null}
          </View>
        </Pressable>

        {hint || error || success ? (
          <AppText
            className="px-2 text-[13px]"
            style={{
              color: error ? colors.negative : success ? colors.positive : colors.muted,
            }}
          >
            {error || success || hint}
          </AppText>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";

export function PasswordInput(
  props: Omit<InputProps, "secureTextEntry" | "trailingNode">,
) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      trailingNode={
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            setVisible((v) => !v);
          }}
          className="p-1 active:opacity-60"
          hitSlop={8}
        >
          {visible ? (
            <EyeIcon size={20} color={colors.muted} />
          ) : (
            <EyeSlashIcon size={20} color={colors.muted} />
          )}
        </Pressable>
      }
    />
  );
}
