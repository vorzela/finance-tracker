/**
 * components/ui/accent-root.tsx
 *
 * Pushes the active palette into CSS variables so utilities like `bg-brand`,
 * `bg-canvas` and `text-ink` follow Settings → Colour / light-dark.
 */

import { useThemeColors } from "@/lib/theme";
import React, { useMemo } from "react";
import { View, type ViewProps } from "react-native";

export function AccentRoot({ style, ...rest }: ViewProps) {
  const colors = useThemeColors();

  const vars = useMemo(
    () => ({
      flex: 1,
      ["--canvas" as string]: colors.canvas,
      ["--surface" as string]: colors.surface,
      ["--raised" as string]: colors.raised,
      ["--subtle" as string]: colors.subtle,
      ["--ink" as string]: colors.ink,
      ["--muted" as string]: colors.muted,
      ["--faint" as string]: colors.faint,
      ["--onbrand" as string]: colors.onBrand,
      ["--hairline" as string]: colors.hairline,
      ["--brand" as string]: colors.brand,
      ["--brand-soft" as string]: colors.brandSoft,
      ["--color-brand" as string]: colors.brand,
      ["--color-brand-soft" as string]: colors.brandSoft,
      ["--positive" as string]: colors.positive,
      ["--positive-soft" as string]: colors.positiveSoft,
      ["--negative" as string]: colors.negative,
      ["--negative-soft" as string]: colors.negativeSoft,
      ["--warn" as string]: colors.warn,
      ["--warn-soft" as string]: colors.warnSoft,
    }),
    [colors],
  );

  return <View {...rest} style={[vars, style]} />;
}
