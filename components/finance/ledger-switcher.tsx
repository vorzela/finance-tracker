/**
 * components/finance/ledger-switcher.tsx
 *
 * The control that swaps between your own spending and a shared household.
 * Everything downstream is keyed by the active scope, so this one tap changes
 * every number on screen.
 */

import { Sheet, SheetOption } from "@/components/ui/sheet";
import { AvatarStack } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { useScope } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
import { useRouter } from "expo-router";
import {
  CaretDownIcon,
  HouseLineIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
} from "phosphor-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PERSONAL_SCOPE } from "@/types/finance";

export function LedgerSwitcher({ inverted = false }: { inverted?: boolean }) {
  const { scope, setScope, groups, activeGroup } = useScope();
  const router = useRouter();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  const label = scope.kind === "personal" ? "Personal" : (activeGroup?.name ?? "Shared");
  const iconColor = inverted ? "#ffffff" : colors.brand;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={cn(
          "flex-row items-center gap-2 self-start rounded-full px-3 py-1.5",
          inverted ? "bg-white/15 active:bg-white/25" : "bg-white active:bg-gray-100",
        )}
      >
        {scope.kind === "personal" ? (
          <UserIcon size={14} color={iconColor} weight="bold" />
        ) : (
          <UsersIcon size={14} color={iconColor} weight="bold" />
        )}
        <Text
          className={cn(
            "text-sm font-bold tracking-tight",
            inverted ? "text-white" : "text-gray-900",
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
        <CaretDownIcon size={12} color={inverted ? "#ffffffaa" : "#6b7280"} weight="bold" />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Which ledger?"
        subtitle="Personal spending stays private. Shared ledgers are visible to everyone in them."
      >
        <SheetOption
          label="Personal"
          description="Only you can see this"
          selected={scope.kind === "personal"}
          leading={
            <View
              className="h-10 w-10 items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.brandSoft }}
            >
              <UserIcon size={20} color={colors.brand} weight="duotone" />
            </View>
          }
          onPress={() => {
            setScope(PERSONAL_SCOPE);
            setOpen(false);
          }}
        />

        {groups.map((group) => (
          <SheetOption
            key={group.id}
            label={group.name}
            description={`${group.memberCount} ${group.memberCount === 1 ? "person" : "people"}`}
            selected={scope.kind === "group" && scope.groupId === group.id}
            leading={
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-green-50">
                <HouseLineIcon size={20} color="#166b3f" weight="duotone" />
              </View>
            }
            onPress={() => {
              setScope({ kind: "group", groupId: group.id });
              setOpen(false);
            }}
          />
        ))}

        <SheetOption
          label={groups.length === 0 ? "Share with someone" : "New shared ledger"}
          description="Create a household or join with an invite code"
          leading={
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-gray-100">
              <PlusIcon size={20} color="#4b5563" weight="bold" />
            </View>
          }
          onPress={() => {
            setOpen(false);
            router.push("/household");
          }}
        />
      </Sheet>
    </>
  );
}

/** Compact "who is in here" strip for the dashboard header. */
export function LedgerMembers({
  people,
}: {
  people: { name: string; color: string }[];
}) {
  if (people.length < 2) return null;

  return (
    <View className="flex-row items-center gap-2">
      <AvatarStack people={people} size="sm" />
      <Text className="text-xs font-medium text-white/70">
        {people.length} people
      </Text>
    </View>
  );
}
