/**
 * components/ui/accent-root.tsx
 *
 * Pushes the selected accent into CSS variables so utilities like `bg-brand`,
 * `text-brand` and `border-brand` follow Settings → Colour theme.
 */

import { useThemeColors } from "@/lib/theme";
import React from "react";
import { View, type ViewProps } from "react-native";

export function AccentRoot({ style, ...rest }: ViewProps) {
  const colors = useThemeColors();

  return (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          // NativeWind / react-native-css resolve semantic utilities from these.
          ["--brand" as string]: colors.brand,
          ["--brand-soft" as string]: colors.brandSoft,
          ["--color-brand" as string]: colors.brand,
          ["--color-brand-soft" as string]: colors.brandSoft,
        },
        style,
      ]}
    />
  );
}
