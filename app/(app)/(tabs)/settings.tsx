/**
 * app/(app)/(tabs)/settings.tsx
 *
 * Everything that isn't a number: who you are, which ledgers you can see, where
 * money lives, appearance, and how this copy of the app is wired to Supabase.
 */

import { Avatar } from "@/components/ui/avatar";
import { Card, IconTile, Row, Section } from "@/components/ui/card";
import { Header, Screen, ScreenScroll } from "@/components/ui/screen";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { useAuth } from "@/lib/auth";
import { currencySymbol } from "@/lib/currency";
import { useAccounts, useProfile } from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { THEME_OPTIONS, useTheme } from "@/lib/theme";
import Constants from "expo-constants";
import { Link, useRouter } from "expo-router";
import {
  BriefcaseIcon,
  CaretRightIcon,
  CurrencyCircleDollarIcon,
  DatabaseIcon,
  HouseLineIcon,
  MoonStarsIcon,
  ScalesIcon,
  SignOutIcon,
  TargetIcon,
  UserIcon,
  WalletIcon,
} from "phosphor-react-native";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

export default function Settings() {
  const { signOut, user, source } = useAuth();
  const { data: profile } = useProfile();
  const { groups, scope, activeGroup } = useScope();
  const { accounts } = useAccounts();
  const { preference, setPreference } = useTheme();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);

  const themeLabel =
    THEME_OPTIONS.find((option) => option.value === preference)?.label ?? "Match phone";

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "Your data stays in Supabase and syncs back when you return.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void signOut().catch(() => {}),
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Settings" />

      <ScreenScroll bottomInset={TAB_BAR_HEIGHT + 24}>
        <Link href="/profile" asChild>
          <Pressable>
            <Card className="flex-row items-center gap-4">
              <Avatar
                name={profile?.display_name ?? "Me"}
                color={profile?.color}
                size="xl"
              />
              <View className="flex-1">
                <Text
                  className="text-xl font-bold tracking-tight text-ink"
                  numberOfLines={1}
                >
                  {profile?.display_name ?? "Your profile"}
                </Text>
                <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>
                  {user?.email}
                </Text>
                <Text className="mt-2 text-sm font-semibold text-brand">
                  Edit name, colour and currency
                </Text>
              </View>
              <CaretRightIcon size={18} color="#9aa9bd" weight="bold" />
            </Card>
          </Pressable>
        </Link>

        <Section title="Ledgers">
          <Card flush>
            <Row
              leading={
                <IconTile color="#2a5298">
                  <HouseLineIcon size={20} color="#2a5298" weight="duotone" />
                </IconTile>
              }
              title={groups.length === 0 ? "Share with your partner" : "Household"}
              subtitle={
                groups.length === 0
                  ? "Create a shared ledger and invite them with a code"
                  : groups.map((group) => group.name).join(" · ")
              }
              chevron
              last
              onPress={() => router.push("/household")}
            />
          </Card>
          <Text className="px-2 text-xs leading-5 text-faint">
            Now viewing{" "}
            <Text className="font-semibold text-muted">
              {scope.kind === "personal"
                ? "your personal ledger"
                : (activeGroup?.name ?? "a shared ledger")}
            </Text>
            . Switch from the button at the top of any screen.
          </Text>
        </Section>

        <Section title="Money">
          <Card flush>
            <Row
              leading={
                <IconTile color="#166b3f">
                  <WalletIcon size={20} color="#166b3f" weight="duotone" />
                </IconTile>
              }
              title="Accounts"
              subtitle={
                accounts.length === 0
                  ? "Add cash, bank or mobile money + opening balance"
                  : `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`
              }
              chevron
              onPress={() => router.push("/accounts")}
            />
            <Row
              leading={
                <IconTile color="#1f9155">
                  <BriefcaseIcon size={20} color="#1f9155" weight="duotone" />
                </IconTile>
              }
              title="Salary & bills"
              subtitle="Monthly income and fixed payments"
              chevron
              onPress={() => router.push("/income")}
            />
            <Row
              leading={
                <IconTile color="#9b0c0c">
                  <ScalesIcon size={20} color="#9b0c0c" weight="duotone" />
                </IconTile>
              }
              title="Debts"
              subtitle="What you owe and what is owed to you"
              chevron
              onPress={() => router.push("/debts")}
            />
            <Row
              leading={
                <IconTile color="#b45309">
                  <TargetIcon size={20} color="#b45309" weight="duotone" />
                </IconTile>
              }
              title="Budgets"
              subtitle="Monthly ceilings per category"
              chevron
              onPress={() => router.push("/budgets")}
            />
            <Row
              leading={
                <IconTile color="#6366f1">
                  <CurrencyCircleDollarIcon size={20} color="#6366f1" weight="duotone" />
                </IconTile>
              }
              title="Currency"
              subtitle={`${profile?.currency_code ?? "KES"} · ${currencySymbol(profile?.currency_code ?? "KES")}`}
              value={
                <Text className="text-sm font-semibold text-brand">Change</Text>
              }
              last
              onPress={() => router.push("/profile")}
            />
          </Card>
        </Section>

        <Section title="Appearance">
          <Card flush>
            <Row
              leading={
                <IconTile color="#1e3a5f">
                  <MoonStarsIcon size={20} color="#1e3a5f" weight="duotone" />
                </IconTile>
              }
              title="Theme"
              subtitle={themeLabel}
              chevron
              last
              onPress={() => setThemeOpen(true)}
            />
          </Card>
        </Section>

        <Section title="Account">
          <Card flush>
            <Row
              leading={
                <IconTile color="#4b5563">
                  <DatabaseIcon size={20} color="#4b5563" weight="duotone" />
                </IconTile>
              }
              title="Supabase"
              subtitle={
                source === "build"
                  ? "Connected using the keys built into this app"
                  : "Connected using keys entered on this phone"
              }
              last={false}
            />
            <Row
              leading={
                <IconTile color="#e02020">
                  <SignOutIcon size={20} color="#e02020" weight="duotone" />
                </IconTile>
              }
              title="Sign out"
              danger
              last
              onPress={confirmSignOut}
            />
          </Card>
        </Section>

        <View className="items-center gap-1 pt-2">
          <View className="flex-row items-center gap-1.5">
            <UserIcon size={12} color="#9ca3af" />
            <Text className="text-xs text-faint">
              {Constants.expoConfig?.name ?? "Duo Wallet"} v
              {Constants.expoConfig?.version ?? "1.0.0"}
            </Text>
          </View>
          <Text className="text-xs text-faint">A financial helper for people and couples.</Text>
        </View>
      </ScreenScroll>

      <Sheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="Theme">
        {THEME_OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            description={option.hint}
            selected={preference === option.value}
            onPress={() => {
              setPreference(option.value);
              setThemeOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
