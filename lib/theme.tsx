/**
 * lib/theme.tsx
 *
 * Light, dark, or follow the phone.
 *
 * The class names in the app resolve their colours through CSS variables that
 * flip on `prefers-color-scheme` (see `global.css`), and React Native decides
 * what that query matches. So all this file has to do is tell React Native
 * which scheme to report, and remember the choice for next launch.
 *
 * `useThemeColors()` is the escape hatch for the places CSS cannot reach:
 * SVG fills in the charts, and props like `tintColor` that take a value rather
 * than a class.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

const STORAGE_KEY = "duo-wallet.theme";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Match phone", hint: "Follows your device setting" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];

interface ThemeContextValue {
  /** What the user picked. */
  preference: ThemePreference;
  /** What that resolves to right now. */
  scheme: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
  /** True once the stored preference has been read, to avoid a flash. */
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(preference: ThemePreference): void {
  // `null` hands control back to the OS.
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);
  const scheme = useColorScheme() ?? "light";

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
          apply(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    apply(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, setPreference, isReady }),
    [preference, scheme, setPreference, isReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

/**
 * The same palette as `global.css`, in a form JavaScript can read. Kept in step
 * by hand: there are only two columns, and the alternative is shipping a CSS
 * parser to the phone.
 */
const PALETTE = {
  light: {
    canvas: "#f6f7fb",
    surface: "#ffffff",
    raised: "#ffffff",
    subtle: "#f3f4f6",
    ink: "#111827",
    muted: "#6b7280",
    faint: "#9ca3af",
    onBrand: "#ffffff",
    hairline: "#f0f1f5",
    brand: "#1e3a5f",
    brandSoft: "#eef2f8",
    positive: "#1f9155",
    positiveSoft: "#f0faf4",
    negative: "#e02020",
    negativeSoft: "#fff1f1",
    warn: "#d97706",
    warnSoft: "#fffbeb",
    /** Behind the status bar and the splash. */
    chrome: "#0d1c33",
  },
  dark: {
    canvas: "#0b1420",
    surface: "#131f2f",
    raised: "#1a2a3e",
    subtle: "#22344b",
    ink: "#f1f5f9",
    muted: "#9aa9bd",
    faint: "#6b7d94",
    onBrand: "#ffffff",
    hairline: "#22344b",
    brand: "#7e9fd0",
    brandSoft: "#1c2c42",
    positive: "#4ade80",
    positiveSoft: "#10261c",
    negative: "#fb7185",
    negativeSoft: "#2a1418",
    warn: "#fbbf24",
    warnSoft: "#2a2010",
    chrome: "#08101a",
  },
} as const;

export type ThemeColors = {
  canvas: string;
  surface: string;
  raised: string;
  subtle: string;
  ink: string;
  muted: string;
  faint: string;
  onBrand: string;
  hairline: string;
  brand: string;
  brandSoft: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warn: string;
  warnSoft: string;
  chrome: string;
};

export function useThemeColors(): ThemeColors {
  const { scheme } = useTheme();
  return PALETTE[scheme];
}

/** For the few call sites outside the provider, such as the root layout. */
export function colorsFor(scheme: "light" | "dark"): ThemeColors {
  return PALETTE[scheme];
}
