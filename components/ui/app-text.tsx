/**
 * components/ui/app-text.tsx
 *
 * Text / TextInput that always use the selected appearance font face.
 * On Android (and New Arch), weight/style must be baked into the face name —
 * never pair a custom fontFamily with fontWeight / fontStyle.
 *
 * NativeWind puts weight in className (`font-bold`), not always in `style`,
 * so we read both, pick the face, then strip weight/italic classes so the
 * interop layer cannot re-apply fontWeight and break the custom face.
 */

import { cn } from "@/lib/cn";
import {
  fontFamilyName,
  type FontWeight,
  useAppearance,
} from "@/lib/theme";
import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";

const WEIGHT_CLASS =
  /\bfont-(?:thin|extralight|light|normal|regular|medium|semibold|bold|extrabold|black)\b/g;
const ITALIC_CLASS = /\bitalic\b/g;

function weightFromClassName(className?: string): FontWeight | null {
  if (!className) return null;
  if (/\bfont-(?:bold|extrabold|black)\b/.test(className)) return "bold";
  if (/\bfont-semibold\b/.test(className)) return "semibold";
  if (/\bfont-medium\b/.test(className)) return "medium";
  if (/\bfont-(?:normal|regular)\b/.test(className)) return "regular";
  if (/\bfont-light\b|\bfont-thin\b|\bfont-extralight\b/.test(className)) return "regular";
  return null;
}

function weightFromStyle(style?: StyleProp<TextStyle>): FontWeight | null {
  const flat = StyleSheet.flatten(style) ?? {};
  const raw = flat.fontWeight;
  if (raw == null) return null;
  const numeric =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw)
        ? Number(raw)
        : raw === "bold"
          ? 700
          : raw === "semibold"
            ? 600
            : raw === "medium"
              ? 500
              : raw === "normal"
                ? 400
                : 400;
  if (numeric >= 700) return "bold";
  if (numeric >= 600) return "semibold";
  if (numeric >= 500) return "medium";
  return "regular";
}

function resolveFamily(
  font: Parameters<typeof fontFamilyName>[0],
  italicPref: boolean,
  className: string | undefined,
  style: StyleProp<TextStyle> | undefined,
): string {
  const flat = StyleSheet.flatten(style) ?? {};
  const isItalic = italicPref || flat.fontStyle === "italic";
  const weight =
    weightFromClassName(className) ?? weightFromStyle(style) ?? "regular";
  return fontFamilyName(font, isItalic, isItalic ? "regular" : weight);
}

/** Drop tokens that would re-introduce fontWeight / fontStyle after we set a face. */
function sanitizeClassName(className?: string): string | undefined {
  if (!className) return className;
  const next = className
    .replace(WEIGHT_CLASS, "")
    .replace(ITALIC_CLASS, "")
    .replace(/\s+/g, " ")
    .trim();
  return next.length > 0 ? next : undefined;
}

const FACE_OVERRIDE: TextStyle = {
  fontWeight: "normal",
  fontStyle: "normal",
};

export const AppText = forwardRef<Text, TextProps>(function AppText(
  { style, className, ...rest },
  ref,
) {
  const { font, italic } = useAppearance();
  const family = resolveFamily(font, italic, className, style);

  return (
    <Text
      ref={ref}
      className={sanitizeClassName(className)}
      style={[style, FACE_OVERRIDE, { fontFamily: family }]}
      {...rest}
    />
  );
});

export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput(
  { style, className, ...rest },
  ref,
) {
  const { font, italic } = useAppearance();
  const family = resolveFamily(font, italic, className, style);

  return (
    <TextInput
      ref={ref}
      className={cn(sanitizeClassName(className))}
      style={[style, FACE_OVERRIDE, { fontFamily: family }]}
      {...rest}
    />
  );
});
