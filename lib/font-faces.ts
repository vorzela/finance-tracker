/**
 * lib/font-faces.ts
 *
 * Font id → loaded expo-font face names. Kept free of React so appearance and
 * runtime helpers can share it without import cycles.
 */

export type FontId =
  | "public"
  | "roboto"
  | "inter"
  | "outfit"
  | "sans"
  | "serif"
  | "nunito"
  | "fraunces"
  | "lora"
  | "literata";

export type FontWeight = "regular" | "medium" | "semibold" | "bold";

type FaceStack = Record<FontWeight, string> & { italic: string };

export const FONT_OPTIONS: { value: FontId; label: string; hint: string }[] = [
  { value: "public", label: "Public Sans", hint: "Samsung-like · clean UI · italic" },
  { value: "roboto", label: "Roboto", hint: "Android / Samsung feel · italic" },
  { value: "inter", label: "Inter", hint: "Product UI · italic" },
  { value: "outfit", label: "Outfit", hint: "Modern geometric" },
  { value: "sans", label: "DM Sans", hint: "Clean modern · italic" },
  { value: "nunito", label: "Nunito", hint: "Soft rounded · italic" },
  { value: "serif", label: "Source Serif", hint: "Editorial · italic" },
  { value: "fraunces", label: "Fraunces", hint: "Warm display · italic" },
  { value: "lora", label: "Lora", hint: "Classic serif · italic" },
  { value: "literata", label: "Literata", hint: "Reading serif · italic" },
];

const FONT_FACES: Record<FontId, FaceStack> = {
  public: {
    regular: "PublicSans_400Regular",
    medium: "PublicSans_500Medium",
    semibold: "PublicSans_600SemiBold",
    bold: "PublicSans_700Bold",
    italic: "PublicSans_400Regular_Italic",
  },
  roboto: {
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    semibold: "Roboto_500Medium",
    bold: "Roboto_700Bold",
    italic: "Roboto_400Regular_Italic",
  },
  inter: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    italic: "Inter_400Regular_Italic",
  },
  outfit: {
    regular: "Outfit_400Regular",
    medium: "Outfit_500Medium",
    semibold: "Outfit_600SemiBold",
    bold: "Outfit_700Bold",
    italic: "Outfit_400Regular",
  },
  sans: {
    regular: "DMSans_400Regular",
    medium: "DMSans_500Medium",
    semibold: "DMSans_600SemiBold",
    bold: "DMSans_700Bold",
    italic: "DMSans_400Regular_Italic",
  },
  serif: {
    regular: "SourceSerif4_400Regular",
    medium: "SourceSerif4_600SemiBold",
    semibold: "SourceSerif4_600SemiBold",
    bold: "SourceSerif4_700Bold",
    italic: "SourceSerif4_400Regular_Italic",
  },
  nunito: {
    regular: "Nunito_400Regular",
    medium: "Nunito_600SemiBold",
    semibold: "Nunito_600SemiBold",
    bold: "Nunito_700Bold",
    italic: "Nunito_400Regular_Italic",
  },
  fraunces: {
    regular: "Fraunces_400Regular",
    medium: "Fraunces_600SemiBold",
    semibold: "Fraunces_600SemiBold",
    bold: "Fraunces_700Bold",
    italic: "Fraunces_400Regular_Italic",
  },
  lora: {
    regular: "Lora_400Regular",
    medium: "Lora_600SemiBold",
    semibold: "Lora_600SemiBold",
    bold: "Lora_700Bold",
    italic: "Lora_400Regular_Italic",
  },
  literata: {
    regular: "Literata_400Regular",
    medium: "Literata_600SemiBold",
    semibold: "Literata_600SemiBold",
    bold: "Literata_700Bold",
    italic: "Literata_400Regular_Italic",
  },
};

export function fontFamilyName(
  font: FontId,
  italic: boolean,
  weight: FontWeight = "regular",
): string {
  const stack = FONT_FACES[font] ?? FONT_FACES.public;
  if (italic) return stack.italic;
  return stack[weight] ?? stack.regular;
}

export function fontFamilyForStyle(
  font: FontId,
  italic: boolean,
  style?: { fontWeight?: string | number; fontStyle?: string } | null,
): string {
  const raw = style?.fontWeight;
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
              : 400;
  const weight: FontWeight =
    numeric >= 700 ? "bold" : numeric >= 600 ? "semibold" : numeric >= 500 ? "medium" : "regular";
  const isItalic = italic || style?.fontStyle === "italic";
  return fontFamilyName(font, isItalic, isItalic ? "regular" : weight);
}
