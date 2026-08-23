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
import { useAccountRows, useProfile } from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { THEME_OPTIONS, ACCENTS, FONT_OPTIONS, useAppearance } from "@/lib/theme";
import Constants from "expo-constants";
import { Link, useRouter } from "expo-router";
import {
  BriefcaseIcon,
  CaretRightIcon,
  ChatCircleIcon,
  ChatTeardropTextIcon,
  CurrencyCircleDollarIcon,
  DatabaseIcon,
  HouseLineIcon,
  MoonStarsIcon,
  PaintBrushIcon,
  QuestionIcon,
  ScalesIcon,
  SignOutIcon,
  TargetIcon,
  TextTIcon,
  UserIcon,
  WalletIcon,
  ListChecksIcon,
} from "phosphor-react-native";
import React, { useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";

export default function Settings() {
  const { signOut, user, source } = useAuth();
  const { data: profile } = useProfile();
  const { groups, scope, activeGroup } = useScope();
  const { data: accounts = [] } = useAccountRows();
  const { schemePreference, setSchemePreference, accent, setAccent, font, setFont, italic, setItalic } =
    useAppearance();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);
  const [accentOpen, setAccentOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);

  const themeLabel =
    THEME_OPTIONS.find((option) => option.value === schemePreference)?.label ??
    "Match phone";
  const fontLabel = (() => {
    const base = FONT_OPTIONS.find((option) => option.value === font)?.label ?? "DM Sans";
    return italic ? `${base} · Italic` : base;
  })();

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
          <Pressable className="active:opacity-80">
            <Card className="flex-row items-center gap-4">
              <Avatar
                name={profile?.display_name ?? "Me"}
                color={profile?.color}
                uri={profile?.avatar_url}
                size="xl"
              />
              <View className="flex-1">
                <AppText
                  className="text-[20px] font-bold tracking-tight text-ink"
                  numberOfLines={1}
                >
                  {profile?.display_name ?? "Your profile"}
                </AppText>
                <AppText className="mt-0.5 text-[13px] text-muted" numberOfLines={1}>
                  {user?.email}
                </AppText>
                <AppText className="mt-2 text-[13px] font-semibold text-brand">
                  Edit profile
                </AppText>
              </View>
              <CaretRightIcon size={16} color="#aeaeb2" weight="bold" />
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
              last={groups.length === 0}
              onPress={() => router.push("/household")}
            />
            {groups.length > 0 ? (
              <Row
                leading={
                  <IconTile color="#2a5298">
                    <ChatCircleIcon size={20} color="#2a5298" weight="duotone" />
                  </IconTile>
                }
                title="Household chat"
                subtitle={
                  scope.kind !== "group"
                    ? "Switch to a shared ledger to message"
                    : (activeGroup?.memberCount ?? 0) >= 3
                      ? "Group chat with everyone in this household"
                      : "Message the other person in this household"
                }
                chevron
                last
                onPress={() => router.push("/chat" as never)}
              />
            ) : null}
          </Card>
          <AppText className="px-2 text-xs leading-5 text-faint">
            Now viewing{" "}
            <AppText className="font-semibold text-muted">
              {scope.kind === "personal"
                ? "your personal ledger"
                : (activeGroup?.name ?? "a shared ledger")}
            </AppText>
            . Switch from the button at the top of any screen.
          </AppText>
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
                <IconTile color="#22a06b">
                  <ChatTeardropTextIcon size={20} color="#22a06b" weight="duotone" />
                </IconTile>
              }
              title="Import M-Pesa"
              subtitle="Read SMS or paste a confirmation"
              chevron
              onPress={() => router.push("/import-mpesa" as never)}
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
                <IconTile color="#0f766e">
                  <ListChecksIcon size={20} color="#0f766e" weight="duotone" />
                </IconTile>
              }
              title="Plans & projects"
              subtitle="Items needed, shopping, business planning"
              chevron
              onPress={() => router.push("/plans")}
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
                <AppText className="text-sm font-semibold text-brand">Change</AppText>
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
              title="Light / dark"
              subtitle={themeLabel}
              chevron
              onPress={() => setThemeOpen(true)}
            />
            <Row
              leading={
                <IconTile color={accent.chip}>
                  <PaintBrushIcon size={20} color={accent.chip} weight="duotone" />
                </IconTile>
              }
              title="Colour theme"
              subtitle={accent.label}
              chevron
              onPress={() => setAccentOpen(true)}
            />
            <Row
              leading={
                <IconTile color="#4b5563">
                  <TextTIcon size={20} color="#4b5563" weight="duotone" />
                </IconTile>
              }
              title="Font"
              subtitle={fontLabel}
              chevron
              last
              onPress={() => setFontOpen(true)}
            />
          </Card>
        </Section>

        <Section title="Help & legal">
          <Card flush>
            <Row
              leading={
                <IconTile color="#1e3a5f">
                  <QuestionIcon size={20} color="#1e3a5f" weight="duotone" />
                </IconTile>
              }
              title="Help"
              subtitle="Usage guide, FAQ, terms & privacy"
              chevron
              last
              onPress={() => router.push("/help")}
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
            <AppText className="text-xs text-faint">
              {Constants.expoConfig?.name ?? "Duo Wallet"} v
              {Constants.expoConfig?.version ?? "1.0.0"}
            </AppText>
          </View>
          <AppText className="text-xs text-faint">A financial helper for people and couples.</AppText>
        </View>
      </ScreenScroll>

      <Sheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="Light / dark">
        {THEME_OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            description={option.hint}
            selected={schemePreference === option.value}
            onPress={() => {
              setSchemePreference(option.value);
              setThemeOpen(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={accentOpen} onClose={() => setAccentOpen(false)} title="Colour theme">
        {ACCENTS.map((option) => (
          <SheetOption
            key={option.id}
            label={option.label}
            selected={accent.id === option.id}
            leading={
              <View
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: option.chip }}
              />
            }
            onPress={() => {
              setAccent(option.id);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={fontOpen} onClose={() => setFontOpen(false)} title="Font">
        {FONT_OPTIONS.map((option) => (
          <SheetOption
            key={option.value}
            label={option.label}
            description={option.hint}
            selected={font === option.value}
            onPress={() => {
              setFont(option.value);
            }}
          />
        ))}
        <SheetOption
          label={italic ? "Italic on" : "Italic off"}
          description="Every font includes a matching italic"
          selected={italic}
          onPress={() => setItalic(!italic)}
        />
      </Sheet>
    </Screen>
  );
}
