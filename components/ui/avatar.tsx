/**
 * components/ui/avatar.tsx
 *
 * Photo when we have one, otherwise initials on the member's colour.
 */

import { cn } from "@/lib/cn";
import { Image } from "expo-image";
import React from "react";
import { Text, View } from "react-native";

const SIZES = {
  xs: { box: 18, text: "text-[9px]" },
  sm: { box: 28, text: "text-[11px]" },
  md: { box: 36, text: "text-sm" },
  lg: { box: 48, text: "text-base" },
  xl: { box: 72, text: "text-2xl" },
} as const;

export interface AvatarProps {
  name: string;
  color?: string;
  /** Remote or local image URI. Falls back to initials when missing. */
  uri?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  color = "#2a5298",
  uri,
  size = "md",
  className,
  ring = false,
}: AvatarProps) {
  const { box, text } = SIZES[size];

  if (uri) {
    return (
      <View
        className={cn("overflow-hidden rounded-full", ring && "border-2 border-white", className)}
        style={{ width: box, height: box }}
      >
        <Image
          source={{ uri }}
          style={{ width: box, height: box }}
          contentFit="cover"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View
      className={cn("items-center justify-center rounded-full", ring && "border-2 border-white", className)}
      style={{ width: box, height: box, backgroundColor: color }}
    >
      <Text className={cn("font-bold tracking-tight text-white", text)}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({
  people,
  size = "sm",
  max = 4,
}: {
  people: { name: string; color: string; uri?: string | null }[];
  size?: keyof typeof SIZES;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View className="flex-row items-center">
      {shown.map((person, index) => (
        <View key={`${person.name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -10 }}>
          <Avatar
            name={person.name}
            color={person.color}
            uri={person.uri}
            size={size}
            ring
          />
        </View>
      ))}
      {extra > 0 && (
        <View
          className="items-center justify-center rounded-full border-2 border-white bg-subtle"
          style={{ width: SIZES[size].box, height: SIZES[size].box, marginLeft: -10 }}
        >
          <Text className="text-[11px] font-bold text-muted">+{extra}</Text>
        </View>
      )}
    </View>
  );
}
