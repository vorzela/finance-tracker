/**
 * lib/appearance.tsx
 *
 * Accent palettes, display fonts and light/dark preference in one place.
 * Accents tint brand colours and hero gradients without rewriting every screen.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FONT_OPTIONS,
  type FontId,
} from "@/lib/font-faces";
import { syncFontRuntime } from "@/lib/font-runtime";
import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

const STORAGE_KEY = "duo-wallet.appearance";

export type SchemePreference = "system" | "light" | "dark";
export type AccentId = "midnight" | "emerald" | "ocean" | "sand" | "rose" | "slate";
export type { FontId, FontWeight } from "@/lib/font-faces";
export { FONT_OPTIONS, fontFamilyName, fontFamilyForStyle } from "@/lib/font-faces";

export interface AccentPalette {
  id: AccentId;
  label: string;
  brand: string;
  brandSoft: string;
  /** Soft mist wash for light mode heroes (pair with dark onGradient text). */
  lightGradient: [string, string, string];
  /** Deeper but still airy wash for dark mode heroes. */
  darkGradient: [string, string, string];
  chip: string;
}

/**
 * Soft, airy accents — misty mid-tones instead of near-black navy blocks.
 * Light gradients stay pale so the dashboard hero never feels like a void.
 */
export const ACCENTS: AccentPalette[] = [
  {
    id: "midnight",
    label: "Sky",
    brand: "#4f74a8",
    brandSoft: "#eaf0f8",
    lightGradient: ["#eef3fa", "#d5e2f4", "#b7ccea"],
    darkGradient: ["#3d5f8f", "#2a4568", "#1c314c"],
    chip: "#6b8fc0",
  },
  {
    id: "emerald",
    label: "Moss",
    brand: "#3d8f64",
    brandSoft: "#eaf6f0",
    lightGradient: ["#eef8f2", "#cfead9", "#9fd4b4"],
    darkGradient: ["#2f7a52", "#1f5639", "#143a27"],
    chip: "#4fa978",
  },
  {
    id: "ocean",
    label: "Lagoon",
    brand: "#2a9bb0",
    brandSoft: "#e8f6f9",
    lightGradient: ["#eaf7fa", "#c5e8ef", "#8fd0de"],
    darkGradient: ["#1f7f91", "#165a68", "#0f3d47"],
    chip: "#3db4c9",
  },
  {
    id: "sand",
    label: "Clay",
    brand: "#c17a3a",
    brandSoft: "#faf3eb",
    lightGradient: ["#faf4ec", "#f0dcc0", "#e0b887"],
    darkGradient: ["#a86630", "#7a4a22", "#4f3016"],
    chip: "#d49252",
  },
  {
    id: "rose",
    label: "Blush",
    brand: "#c45b78",
    brandSoft: "#faf0f3",
    lightGradient: ["#faf0f3", "#efd0da", "#e0a0b4"],
    darkGradient: ["#a84864", "#763248", "#4a2030"],
    chip: "#d47892",
  },
  {
    id: "slate",
    label: "Fog",
    brand: "#5c6b7d",
    brandSoft: "#f1f3f6",
    lightGradient: ["#f2f4f7", "#d9dee6", "#b4bdc9"],
    darkGradient: ["#4a5564", "#343d4a", "#222830"],
    chip: "#7a8796",
  },
];

export const SCHEME_OPTIONS: { value: SchemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Match phone", hint: "Follows your device setting" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];


interface StoredAppearance {
  scheme: SchemePreference;
  accent: AccentId;
  font: FontId;
  italic?: boolean;
}

interface AppearanceContextValue {
  schemePreference: SchemePreference;
  scheme: "light" | "dark";
  accent: AccentPalette;
  font: FontId;
  italic: boolean;
  colors: ThemeColors;
  setSchemePreference: (value: SchemePreference) => void;
  setAccent: (value: AccentId) => void;
  setFont: (value: FontId) => void;
  setItalic: (value: boolean) => void;
  isReady: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** System-grouped neutrals — Apple HIG / Material You calm, not high-contrast. */
const BASE = {
  light: {
    canvas: "#f2f2f7",
    surface: "#ffffff",
    raised: "#ffffff",
    subtle: "#ebebf0",
    ink: "#1c1c1e",
    muted: "#8e8e93",
    faint: "#aeaeb2",
    onBrand: "#ffffff",
    hairline: "#e5e5ea",
    positive: "#34c759",
    positiveSoft: "#e8f8ee",
    negative: "#ff3b30",
    negativeSoft: "#ffeceb",
    warn: "#ff9f0a",
    warnSoft: "#fff6e8",
    chrome: "#1c1c1e",
  },
  dark: {
    canvas: "#000000",
    surface: "#1c1c1e",
    raised: "#2c2c2e",
    subtle: "#3a3a3c",
    ink: "#f5f5f7",
    muted: "#98989d",
    faint: "#636366",
    onBrand: "#ffffff",
    hairline: "#38383a",
    positive: "#30d158",
    positiveSoft: "#0f2a18",
    negative: "#ff453a",
    negativeSoft: "#3a1210",
    warn: "#ffd60a",
    warnSoft: "#2a2208",
    chrome: "#000000",
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
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warn: string;
  warnSoft: string;
  chrome: string;
  brand: string;
  brandSoft: string;
  gradient: [string, string, string];
  /** Primary text / icons sitting on the hero gradient. */
  onGradient: string;
  onGradientMuted: string;
  /** True when the hero uses light-on-dark (dark scheme). */
  heroInverted: boolean;
};

function applyScheme(preference: SchemePreference): void {
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

function accentById(id: AccentId): AccentPalette {
  return ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
}

export function colorsFor(
  scheme: "light" | "dark",
  accentId: AccentId = "midnight",
): ThemeColors {
  const accent = accentById(accentId);
  const base = BASE[scheme];
  const heroInverted = scheme === "dark";
  return {
    ...base,
    brand: scheme === "dark" ? lighten(accent.brand) : accent.brand,
    brandSoft: scheme === "dark" ? softDark(accent.brandSoft) : accent.brandSoft,
    gradient: heroInverted ? accent.darkGradient : accent.lightGradient,
    onGradient: heroInverted ? "#ffffff" : "#1c1c1e",
    onGradientMuted: heroInverted ? "rgba(255,255,255,0.68)" : "rgba(28,28,30,0.55)",
    heroInverted,
  };
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [schemePreference, setSchemePreferenceState] =
    useState<SchemePreference>("system");
  const [accentId, setAccentId] = useState<AccentId>("midnight");
  const [font, setFontState] = useState<FontId>("public");
  const [italic, setItalicState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scheme = useColorScheme() ?? "light";
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ schemePreference, accentId, font, italic });
  latest.current = { schemePreference, accentId, font, italic };

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredAppearance>;
        if (parsed.scheme === "light" || parsed.scheme === "dark" || parsed.scheme === "system") {
          setSchemePreferenceState(parsed.scheme);
          applyScheme(parsed.scheme);
        }
        if (parsed.accent && ACCENTS.some((a) => a.id === parsed.accent)) {
          setAccentId(parsed.accent);
        }
        if (parsed.font && FONT_OPTIONS.some((option) => option.value === parsed.font)) {
          setFontState(parsed.font);
        }
        if (typeof parsed.italic === "boolean") {
          setItalicState(parsed.italic);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const snap = latest.current;
      void AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scheme: snap.schemePreference,
          accent: snap.accentId,
          font: snap.font,
          italic: snap.italic,
        } satisfies StoredAppearance),
      ).catch(() => {});
    }, 280);
  }, []);

  const setSchemePreference = useCallback(
    (value: SchemePreference) => {
      startTransition(() => {
        setSchemePreferenceState(value);
        applyScheme(value);
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const setAccent = useCallback(
    (value: AccentId) => {
      startTransition(() => {
        setAccentId(value);
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const setFont = useCallback(
    (value: FontId) => {
      startTransition(() => {
        setFontState(value);
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const setItalic = useCallback(
    (value: boolean) => {
      startTransition(() => {
        setItalicState(value);
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const accent = useMemo(() => accentById(accentId), [accentId]);
  const colors = useMemo(() => colorsFor(scheme, accentId), [scheme, accentId]);

  useEffect(() => {
    syncFontRuntime(font, italic);
  }, [font, italic]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      schemePreference,
      scheme,
      accent,
      font,
      italic,
      colors,
      setSchemePreference,
      setAccent,
      setFont,
      setItalic,
      isReady,
    }),
    [
      schemePreference,
      scheme,
      accent,
      font,
      italic,
      colors,
      setSchemePreference,
      setAccent,
      setFont,
      setItalic,
      isReady,
    ],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}

/** @deprecated use useAppearance — kept so older imports keep compiling while we migrate. */
export function useTheme() {
  const appearance = useAppearance();
  return {
    preference: appearance.schemePreference,
    scheme: appearance.scheme,
    setPreference: appearance.setSchemePreference,
    isReady: appearance.isReady,
  };
}

export function useThemeColors(): ThemeColors {
  return useAppearance().colors;
}

function softDark(lightSoft: string): string {
  if (lightSoft === "#eaf6f0") return "#1a2e24";
  if (lightSoft === "#e8f6f9") return "#152830";
  if (lightSoft === "#faf3eb") return "#2a2418";
  if (lightSoft === "#faf0f3") return "#2c1a20";
  if (lightSoft === "#f1f3f6") return "#232d3a";
  return "#1c2838";
}

function lighten(hex: string): string {
  if (hex === "#4f74a8") return "#8eacd4";
  if (hex === "#3d8f64") return "#6ec99a";
  if (hex === "#2a9bb0") return "#6fcfda";
  if (hex === "#c17a3a") return "#e0b078";
  if (hex === "#c45b78") return "#e0a0b4";
  if (hex === "#5c6b7d") return "#a8b4c4";
  return hex;
}

// Re-export old names used by settings
export const THEME_OPTIONS = SCHEME_OPTIONS;
export type ThemePreference = SchemePreference;
