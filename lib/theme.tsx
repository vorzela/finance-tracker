/**
 * lib/theme.tsx
 *
 * Compatibility surface — appearance (accents, fonts, scheme) lives in
 * `lib/appearance.tsx`. Existing imports of `useTheme` / `useThemeColors`
 * keep working.
 */

export {
  AppearanceProvider as ThemeProvider,
  useAppearance,
  useTheme,
  useThemeColors,
  colorsFor,
  fontFamilyName,
  fontFamilyForStyle,
  THEME_OPTIONS,
  SCHEME_OPTIONS,
  FONT_OPTIONS,
  ACCENTS,
  type ThemeColors,
  type ThemePreference,
  type SchemePreference,
  type AccentId,
  type FontId,
  type AccentPalette,
  type FontWeight,
} from "@/lib/appearance";
