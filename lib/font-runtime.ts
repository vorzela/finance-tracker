/**
 * lib/font-runtime.ts
 */

import {
  fontFamilyForStyle,
  type FontId,
} from "@/lib/font-faces";
import type { TextStyle } from "react-native";

let current: { font: FontId; italic: boolean } = { font: "public", italic: false };

export function syncFontRuntime(font: FontId, italic: boolean): void {
  current = { font, italic };
}

export function activeFontFamily(style?: TextStyle | TextStyle[] | null): string {
  const flat = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : (style ?? {});
  return fontFamilyForStyle(current.font, current.italic, flat);
}
