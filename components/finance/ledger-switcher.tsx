/**
 * components/finance/ledger-switcher.tsx
 *
 * Scope pill that swaps personal vs shared ledgers.
 */

import { AppText } from "@/components/ui/app-text";

import { AvatarStack } from "@/components/ui/avatar";
import { Sheet, SheetOption } from "@/components/ui/sheet";
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
import { Pressable, View } from "react-native";
import { PERSONAL_SCOPE } from "@/types/finance";

export function LedgerSwitcher({ inverted = false }: { inverted?: boolean }) {
  const { scope, setScope, groups, activeGroup } = useScope();
  const router = useRouter();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  const label = scope.kind === "personal" ? "Personal" : (activeGroup?.name ?? "Shared");
  const iconColor = inverted ? "#ffffff" : colors.brand;
  const chipBg = inverted ? "rgba(255,255,255,0.18)" : colors.subtle;
  const labelColor = inverted ? "#ffffff" : colors.ink;
  const caretColor = inverted ? "rgba(255,255,255,0.7)" : colors.muted;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="will-change-pressable flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 active:opacity-75"
        style={{ backgroundColor: chipBg }}
      >
        {scope.kind === "personal" ? (
          <UserIcon size={13} color={iconColor} weight="bold" />
        ) : (
          <UsersIcon size={13} color={iconColor} weight="bold" />
        )}
        <AppText
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: labelColor }}
          numberOfLines={1}
        >
          {label}
        </AppText>
        <CaretDownIcon size={11} color={caretColor} weight="bold" />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Ledger"
        subtitle="Personal stays private. Shared is visible to everyone in it."
      >
        <SheetOption
          label="Personal"
          description="Only you can see this"
          selected={scope.kind === "personal"}
          leading={
            <View
              className="h-10 w-10 items-center justify-center rounded-[12px]"
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
              <View
                className="h-10 w-10 items-center justify-center rounded-[12px]"
                style={{ backgroundColor: colors.positiveSoft }}
              >
                <HouseLineIcon size={20} color={colors.positive} weight="duotone" />
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
            <View
              className="h-10 w-10 items-center justify-center rounded-[12px]"
              style={{ backgroundColor: colors.subtle }}
            >
              <PlusIcon size={20} color={colors.muted} weight="bold" />
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

export function LedgerMembers({
  people,
}: {
  people: { name: string; color: string }[];
}) {
  if (people.length < 2) return null;

  return (
    <View className="flex-row items-center gap-2">
      <AvatarStack people={people} size="sm" />
      <AppText className="text-[12px] font-medium text-muted">{people.length} people</AppText>
    </View>
  );
}
