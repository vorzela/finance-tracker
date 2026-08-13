/**
 * lib/appearance.tsx
 *
 * Accent palettes, display fonts and light/dark preference in one place.
 * Accents tint brand colours and hero gradients without rewriting every screen.
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

const STORAGE_KEY = "duo-wallet.appearance";

export type SchemePreference = "system" | "light" | "dark";
export type AccentId = "midnight" | "emerald" | "ocean" | "sand" | "rose" | "slate";
export type FontId = "sans" | "serif" | "nunito" | "fraunces" | "lora" | "literata";

export interface AccentPalette {
  id: AccentId;
  label: string;
  brand: string;
  brandSoft: string;
  gradient: [string, string, string];
  chip: string;
}

export const ACCENTS: AccentPalette[] = [
  {
    id: "midnight",
    label: "Midnight",
    brand: "#1e3a5f",
    brandSoft: "#eef2f8",
    gradient: ["#2f5ba8", "#1b3560", "#0d1c33"],
    chip: "#2a5298",
  },
  {
    id: "emerald",
    label: "Emerald",
    brand: "#166b3f",
    brandSoft: "#e8f6ee",
    gradient: ["#2f9e63", "#166b3f", "#0b3d24"],
    chip: "#1f9155",
  },
  {
    id: "ocean",
    label: "Ocean",
    brand: "#0e7490",
    brandSoft: "#e6f7fb",
    gradient: ["#22b8cf", "#0e7490", "#164e63"],
    chip: "#0891b2",
  },
  {
    id: "sand",
    label: "Sand",
    brand: "#92400e",
    brandSoft: "#f8efe4",
    gradient: ["#d97706", "#b45309", "#78350f"],
    chip: "#d97706",
  },
  {
    id: "rose",
    label: "Rose",
    brand: "#9f1239",
    brandSoft: "#fde8ef",
    gradient: ["#e11d48", "#9f1239", "#4c0519"],
    chip: "#e11d48",
  },
  {
    id: "slate",
    label: "Slate",
    brand: "#334155",
    brandSoft: "#f1f5f9",
    gradient: ["#64748b", "#334155", "#0f172a"],
    chip: "#475569",
  },
];

export const SCHEME_OPTIONS: { value: SchemePreference; label: string; hint: string }[] = [
  { value: "system", label: "Match phone", hint: "Follows your device setting" },
  { value: "light", label: "Light", hint: "Always light" },
  { value: "dark", label: "Dark", hint: "Always dark" },
];

export const FONT_OPTIONS: { value: FontId; label: string; hint: string }[] = [
  { value: "sans", label: "DM Sans", hint: "Clean modern · italic available" },
  { value: "serif", label: "Source Serif", hint: "Editorial · italic available" },
  { value: "nunito", label: "Nunito", hint: "Soft rounded · italic available" },
  { value: "fraunces", label: "Fraunces", hint: "Warm display · italic available" },
  { value: "lora", label: "Lora", hint: "Classic serif · italic available" },
  { value: "literata", label: "Literata", hint: "Reading serif · italic available" },
];

/** Maps a font choice (+ italic) to the loaded expo-font family name. */
export function fontFamilyName(font: FontId, italic: boolean): string {
  const map: Record<FontId, { regular: string; italic: string }> = {
    sans: { regular: "DMSans_400Regular", italic: "DMSans_400Regular_Italic" },
    serif: {
      regular: "SourceSerif4_400Regular",
      italic: "SourceSerif4_400Regular_Italic",
    },
    nunito: { regular: "Nunito_400Regular", italic: "Nunito_400Regular_Italic" },
    fraunces: {
      regular: "Fraunces_400Regular",
      italic: "Fraunces_400Regular_Italic",
    },
    lora: { regular: "Lora_400Regular", italic: "Lora_400Regular_Italic" },
    literata: {
      regular: "Literata_400Regular",
      italic: "Literata_400Regular_Italic",
    },
  };
  const pair = map[font] ?? map.sans;
  return italic ? pair.italic : pair.regular;
}

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
  setSchemePreference: (value: SchemePreference) => void;
  setAccent: (value: AccentId) => void;
  setFont: (value: FontId) => void;
  setItalic: (value: boolean) => void;
  isReady: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const BASE = {
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
    positive: "#1f9155",
    positiveSoft: "#f0faf4",
    negative: "#e02020",
    negativeSoft: "#fff1f1",
    warn: "#d97706",
    warnSoft: "#fffbeb",
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
};

function applyScheme(preference: SchemePreference): void {
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

function accentById(id: AccentId): AccentPalette {
  return ACCENTS.find((item) => item.id === id) ?? ACCENTS[0];
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [schemePreference, setSchemePreferenceState] =
    useState<SchemePreference>("system");
  const [accentId, setAccentId] = useState<AccentId>("midnight");
  const [font, setFontState] = useState<FontId>("sans");
  const [italic, setItalicState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scheme = useColorScheme() ?? "light";

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
    };
  }, []);

  const persist = useCallback((next: StoredAppearance) => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setSchemePreference = useCallback(
    (value: SchemePreference) => {
      setSchemePreferenceState(value);
      applyScheme(value);
      persist({ scheme: value, accent: accentId, font, italic });
    },
    [accentId, font, italic, persist],
  );

  const setAccent = useCallback(
    (value: AccentId) => {
      setAccentId(value);
      persist({ scheme: schemePreference, accent: value, font, italic });
    },
    [schemePreference, font, italic, persist],
  );

  const setFont = useCallback(
    (value: FontId) => {
      setFontState(value);
      persist({ scheme: schemePreference, accent: accentId, font: value, italic });
    },
    [schemePreference, accentId, italic, persist],
  );

  const setItalic = useCallback(
    (value: boolean) => {
      setItalicState(value);
      persist({ scheme: schemePreference, accent: accentId, font, italic: value });
    },
    [schemePreference, accentId, font, persist],
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({
      schemePreference,
      scheme,
      accent: accentById(accentId),
      font,
      italic,
      setSchemePreference,
      setAccent,
      setFont,
      setItalic,
      isReady,
    }),
    [
      schemePreference,
      scheme,
      accentId,
      font,
      italic,
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
  const { scheme, accent } = useAppearance();
  const base = BASE[scheme];
  const brand = scheme === "dark" ? lighten(accent.brand) : accent.brand;
  return {
    ...base,
    brand,
    brandSoft: scheme === "dark" ? softDark(accent.brandSoft) : accent.brandSoft,
    gradient: accent.gradient,
  };
}

export function colorsFor(scheme: "light" | "dark", accentId: AccentId = "midnight"): ThemeColors {
  const accent = accentById(accentId);
  const base = BASE[scheme];
  return {
    ...base,
    brand: scheme === "dark" ? lighten(accent.brand) : accent.brand,
    brandSoft: scheme === "dark" ? softDark(accent.brandSoft) : accent.brandSoft,
    gradient: accent.gradient,
  };
}

function softDark(lightSoft: string): string {
  // Keep a dark-tinted soft fill that still hints at the accent.
  if (lightSoft === "#e8f6ee") return "#10261c";
  if (lightSoft === "#e6f7fb") return "#0c2a33";
  if (lightSoft === "#f8efe4") return "#2a2010";
  if (lightSoft === "#fde8ef") return "#2a1418";
  if (lightSoft === "#f1f5f9") return "#1e293b";
  return "#1c2c42";
}

function lighten(hex: string): string {
  // Simple lift so deep accents stay readable on dark canvas.
  if (hex === "#1e3a5f") return "#7e9fd0";
  if (hex === "#166b3f") return "#4ade80";
  if (hex === "#0e7490") return "#67e8f9";
  if (hex === "#92400e") return "#fbbf24";
  if (hex === "#9f1239") return "#fb7185";
  if (hex === "#334155") return "#94a3b8";
  return hex;
}

// Re-export old names used by settings
export const THEME_OPTIONS = SCHEME_OPTIONS;
export type ThemePreference = SchemePreference;
