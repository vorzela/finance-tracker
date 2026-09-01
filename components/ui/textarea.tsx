/**
 * components/ui/textarea.tsx
 *
 * Apple-inspired auto-growing textarea.
 * - Grows line-by-line up to `maxRows`, then becomes scrollable (or keeps
 *   growing if `grow` is true).
 * - Optional `maxLength` / `minLength` with an animated character counter
 *   that warns when approaching the limit (>= 80 %).
 * - Label floats up on focus / content (same animation as Input).
 * - All state animations run on the UI thread via Reanimated.
 */

import { cn } from "@/lib/cn";
import { SheetInputContext } from "@/components/ui/sheet";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { CheckCircleIcon, WarningCircleIcon } from "phosphor-react-native";
import React, { forwardRef, useContext, useEffect, useRef, useState } from "react";
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

// ── Shared constants (must match global.css) ──────────────────────────────────
const LINE_HEIGHT = 22; // matches text-base on RN
const C = {
  default: "#6b7280",
  focused: "#1e3a5f",
  success: "#166b3f",
  error: "#e02020",
  warning: "#d97706", // gold-500
} as const;

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

// ── Props ─────────────────────────────────────────────────────────────────────
export interface TextAreaProps extends Omit<
  TextInputProps,
  "multiline" | "numberOfLines" | "scrollEnabled"
> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  /** Minimum number of visible rows (default 3). */
  minRows?: number;
  /**
   * Maximum rows before the textarea becomes scrollable.
   * Pass `undefined` (or set `grow=true`) to keep growing indefinitely.
   */
  maxRows?: number;
  /**
   * When true the textarea always grows — `maxRows` is ignored.
   * @default false
   */
  grow?: boolean;
  /** Hard character limit. Shows an animated counter near the limit. */
  maxLength?: number;
  /** Warn when length >= this fraction of maxLength (default 0.8). */
  warnAt?: number;
  /** Minimum character count; shown below the field as a hint. */
  minLength?: number;
  wrapClassName?: string;
}

export const TextArea = forwardRef<TextInput, TextAreaProps>(
  (
    {
      label,
      hint,
      error,
      success,
      required,
      minRows = 3,
      maxRows = 6,
      grow = false,
      maxLength,
      warnAt = 0.8,
      minLength,
      wrapClassName,
      className,
      onFocus,
      onBlur,
      onChangeText,
      value,
      defaultValue,
      ...rest
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");

    const currentValue = value ?? internalValue;
    const charCount = currentValue.length;
    const isActive = isFocused || charCount > 0;

    // ── Height animation ──────────────────────────────────────────────────────
    const minHeight = minRows * LINE_HEIGHT + 24; // 24 = top + bottom padding
    const [contentHeight, setContentHeight] = useState(minHeight);
    const animatedHeight = useSharedValue(minHeight);

    useEffect(() => {
      const maxHeight =
        maxRows !== undefined && !grow ? maxRows * LINE_HEIGHT + 24 : Infinity;
      const target = Math.max(minHeight, Math.min(contentHeight, maxHeight));
      animatedHeight.value = withTiming(target, { duration: 150 });
    }, [contentHeight, minHeight, maxRows, grow]);

    const scrollEnabled =
      !grow &&
      maxRows !== undefined &&
      contentHeight > maxRows * LINE_HEIGHT + 24;

    const heightStyle = useAnimatedStyle(() => ({
      height: animatedHeight.value,
    }));

    // ── Label animation (identical to Input) ─────────────────────────────────
    const labelSize = useSharedValue(isActive ? 11 : 12);
    const labelY = useSharedValue(isActive ? 0 : 8);

    useEffect(() => {
      const cfg = { duration: 180 };
      labelSize.value = withTiming(isActive ? 11 : 12, cfg);
      labelY.value = withTiming(isActive ? 0 : 8, cfg);
    }, [isActive]);

    const cm = useSharedValue(colorMode(error, success, isFocused));
    useEffect(() => {
      cm.value = withTiming(colorMode(error, success, isFocused), {
        duration: 150,
      });
    }, [error, success, isFocused]);

    const labelAnimStyle = useAnimatedStyle(() => ({
      fontSize: labelSize.value,
      transform: [{ translateY: labelY.value }],
      color: interpolateColor(
        cm.value,
        [0, 1, 2, 3],
        [C.default, C.focused, C.success, C.error],
      ),
    }));

    // ── Character counter animation ───────────────────────────────────────────
    const isNearLimit =
      maxLength !== undefined && charCount >= Math.floor(maxLength * warnAt);
    const isAtLimit = maxLength !== undefined && charCount >= maxLength;
    const counterOpacity = useSharedValue(0);

    useEffect(() => {
      counterOpacity.value = withTiming(
        maxLength !== undefined && (isFocused || isNearLimit) ? 1 : 0,
        { duration: 200 },
      );
    }, [isFocused, isNearLimit, maxLength]);

    const counterStyle = useAnimatedStyle(() => ({
      opacity: counterOpacity.value,
    }));

    // ── Ref merge ─────────────────────────────────────────────────────────────
    const insideSheet = useContext(SheetInputContext);
    // See SheetInputContext's comment on why this swap is needed inside a Sheet.
    const Field = (insideSheet ? BottomSheetTextInput : TextInput) as typeof TextInput;
    const internalRef = useRef<TextInput>(null);
    const mergeRef = (node: TextInput | null) => {
      (internalRef as React.MutableRefObject<TextInput | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref)
        (ref as React.MutableRefObject<TextInput | null>).current = node;
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
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

    // ── Sub-hint logic ────────────────────────────────────────────────────────
    const subHint = error
      ? error
      : success
        ? success
        : minLength && charCount < minLength
          ? `Minimum ${minLength} characters`
          : hint;

    const subHintColor = error
      ? "text-red-500"
      : success
        ? "text-green-600"
        : "text-gray-500";

    return (
      <View className={cn("w-full gap-1.5", wrapClassName)}>
        <Pressable
          onPress={() => internalRef.current?.focus()}
          className={cn(
            "rounded-2xl border px-4 pt-3 pb-2",
            getBorderClasses(error, success, isFocused),
          )}
        >
          {label && (
            <Animated.Text
              style={labelAnimStyle}
              className="font-bold tracking-wider mb-1"
            >
              {label}
              {required && <Text className="text-red-500"> *</Text>}
            </Animated.Text>
          )}

          <Animated.View style={heightStyle}>
            <Field
              ref={mergeRef}
              className={cn(
                "text-base text-gray-900 p-0 m-0 flex-1",
                className,
              )}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              scrollEnabled={scrollEnabled}
              maxLength={maxLength}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onChangeText={handleChangeText}
              onContentSizeChange={(e) =>
                setContentHeight(e.nativeEvent.contentSize.height)
              }
              value={value}
              defaultValue={defaultValue}
              {...rest}
            />
          </Animated.View>

          {/* Trailing validation icons */}
          {(error || success) && (
            <View className="absolute right-4 top-3">
              {error ? (
                <WarningCircleIcon size={18} color="#f85252" weight="fill" />
              ) : (
                <CheckCircleIcon size={18} color="#3db077" weight="fill" />
              )}
            </View>
          )}
        </Pressable>

        {/* Footer row: hint / error on left, character counter on right */}
        <View className="flex-row justify-between items-start px-2">
          <Text className={cn("text-sm flex-1", subHintColor)}>
            {subHint ?? ""}
          </Text>

          {maxLength && (
            <Animated.Text
              style={counterStyle}
              className={cn(
                "text-xs font-medium ml-2",
                isAtLimit
                  ? "text-red-500"
                  : isNearLimit
                    ? "text-gold-500"
                    : "text-gray-400",
              )}
            >
              {charCount}/{maxLength}
            </Animated.Text>
          )}
        </View>
      </View>
    );
  },
);

TextArea.displayName = "TextArea";
