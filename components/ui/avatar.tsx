/**
 * components/ui/avatar.tsx
 *
 * Initials on the member's colour. No photo uploads means no storage bucket,
 * no permissions prompt, and nothing to load before a list can render.
 */

import { cn } from "@/lib/cn";
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
  size?: keyof typeof SIZES;
  className?: string;
  /** Draws a white ring, for avatars stacked on a coloured surface. */
  ring?: boolean;
}

/** "Grace Wanjiru" -> "GW", "grace" -> "G". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  color = "#2a5298",
  size = "md",
  className,
  ring = false,
}: AvatarProps) {
  const { box, text } = SIZES[size];

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

/** Overlapping avatars, for "who is in this household" at a glance. */
export function AvatarStack({
  people,
  size = "sm",
  max = 4,
}: {
  people: { name: string; color: string }[];
  size?: keyof typeof SIZES;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <View className="flex-row items-center">
      {shown.map((person, index) => (
        <View key={`${person.name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -10 }}>
          <Avatar name={person.name} color={person.color} size={size} ring />
        </View>
      ))}
      {extra > 0 && (
        <View
          className="items-center justify-center rounded-full border-2 border-white bg-gray-300"
          style={{ width: SIZES[size].box, height: SIZES[size].box, marginLeft: -10 }}
        >
          <Text className="text-[11px] font-bold text-gray-700">+{extra}</Text>
        </View>
      )}
    </View>
  );
}
