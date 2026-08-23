/**
 * app/(app)/household.tsx
 *
 * Shared ledgers: create one, join one with a code, see who is in it, and hand
 * out the invite. The invite code is the whole onboarding story for the second
 * person — they install the APK, sign up, and type six characters.
 */

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, IconTile, Row, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote, Header, Screen, ScreenScroll } from "@/components/ui/screen";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import {
  useCreateGroup,
  useCurrency,
  useJoinGroup,
  useLeaveGroup,
  useMembers,
  useProfile,
  useRenameGroup,
  useRotateInviteCode,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ArrowsClockwiseIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  CopyIcon,
  HouseLineIcon,
  PencilSimpleIcon,
  ShareIcon,
  SignOutIcon,
  UserPlusIcon,
  UsersIcon,
} from "phosphor-react-native";
import React, { useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, Share, View } from "react-native";

export default function Household() {
  const { groups, scope, setScope } = useScope();
  const { data: profile } = useProfile();
  const { data: members } = useMembers();
  const currency = useCurrency();
  const colors = useThemeColors();
  const router = useRouter();

  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();
  const rotate = useRotateInviteCode();
  const rename = useRenameGroup();
  const leave = useLeaveGroup();

  const [mode, setMode] = useState<"none" | "create" | "join" | "rename">("none");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState(profile?.currency_code ?? "KES");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeGroup =
    scope.kind === "group" ? groups.find((group) => group.id === scope.groupId) : undefined;

  const submitCreate = async () => {
    if (name.trim().length < 2) {
      setFormError("Give the household a name.");
      return;
    }
    setFormError(null);
    try {
      await createGroup.mutateAsync({ name, currencyCode });
      setMode("none");
      setName("");
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't create the household"));
    }
  };

  const submitJoin = async () => {
    if (code.trim().length < 6) {
      setFormError("Invite codes are six characters.");
      return;
    }
    setFormError(null);
    try {
      await joinGroup.mutateAsync(code);
      setMode("none");
      setCode("");
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't join"));
    }
  };

  const submitRename = async () => {
    if (!activeGroup || name.trim().length < 2) {
      setFormError("Give the household a name.");
      return;
    }
    setFormError(null);
    try {
      await rename.mutateAsync({ groupId: activeGroup.id, name });
      setMode("none");
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't rename"));
    }
  };

  const copyCode = async (value: string) => {
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async (groupName: string, value: string) => {
    await Share.share({
      message: `Join "${groupName}" on Duo Wallet so we can track our spending together. Invite code: ${value}`,
    }).catch(() => {});
  };

  const confirmRotate = (groupId: string) => {
    Alert.alert(
      "Get a new code?",
      "The current code stops working immediately. Anyone already in the household stays in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "New code",
          onPress: () => void rotate.mutateAsync(groupId).catch(() => {}),
        },
      ],
    );
  };

  const confirmLeave = (groupId: string, groupName: string) => {
    Alert.alert(
      `Leave ${groupName}?`,
      "You'll stop seeing its transactions. Anything you added stays with the household.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => void leave.mutateAsync(groupId).catch(() => {}),
        },
      ],
    );
  };

  return (
    <Screen>
      <Header title="Household" subtitle="Shared ledgers" back />

      <ScreenScroll>
        {/* ── Active household ─────────────────────────────────────────── */}
        {activeGroup ? (
          <Section title="Now viewing">
            <Card className="gap-4">
              <View className="flex-row items-center gap-3">
                <IconTile color="#166b3f" size={44}>
                  <HouseLineIcon size={22} color="#166b3f" weight="duotone" />
                </IconTile>
                <View className="flex-1">
                  <AppText className="text-lg font-bold tracking-tight text-gray-900">
                    {activeGroup.name}
                  </AppText>
                  <AppText className="text-sm text-gray-500">
                    {activeGroup.memberCount}{" "}
                    {activeGroup.memberCount === 1 ? "person" : "people"} ·{" "}
                    {activeGroup.currency_code}
                  </AppText>
                </View>
                {activeGroup.role === "owner" ? (
                  <Pressable
                    onPress={() => {
                      setName(activeGroup.name);
                      setFormError(null);
                      setMode("rename");
                    }}
                    hitSlop={10}
                    className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
                  >
                    <PencilSimpleIcon size={16} color="#4b5563" weight="bold" />
                  </Pressable>
                ) : null}
              </View>

              {/* Invite code */}
              <View className="rounded-2xl border border-dashed border-navy-200 bg-navy-50 p-4">
                <AppText className="text-xs font-bold uppercase tracking-widest text-navy-500">
                  Invite code
                </AppText>
                <AppText className="mt-1 text-3xl font-bold tracking-[8px] text-navy-700">
                  {activeGroup.invite_code}
                </AppText>
                <AppText className="mt-1 text-xs leading-5 text-navy-500">
                  They install the app, sign up, then tap Join with a code.
                </AppText>

                <View className="mt-3 flex-row gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    icon={
                      copied ? (
                        <CheckCircleIcon size={16} color="#fff" weight="fill" />
                      ) : (
                        <CopyIcon size={16} color="#fff" weight="bold" />
                      )
                    }
                    onPress={() => void copyCode(activeGroup.invite_code)}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    icon={<ShareIcon size={16} color="#111827" weight="bold" />}
                    onPress={() => void shareCode(activeGroup.name, activeGroup.invite_code)}
                  >
                    Share
                  </Button>
                </View>
              </View>

              {/* Members */}
              <View className="gap-3">
                <AppText className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Members
                </AppText>
                {(members ?? []).map((member) => (
                  <View key={member.id} className="flex-row items-center gap-3">
                    <Avatar name={member.name} color={member.color} size="md" />
                    <View className="flex-1">
                      <AppText className="text-base font-semibold text-gray-900">
                        {member.isSelf ? `${member.name} (you)` : member.name}
                      </AppText>
                      <AppText className="text-xs capitalize text-gray-500">{member.role}</AppText>
                    </View>
                  </View>
                ))}
              </View>

              {(members ?? []).length >= 2 ? (
                <Button
                  size="lg"
                  icon={<ChatCircleIcon size={18} color={colors.onBrand} weight="fill" />}
                  onPress={() => router.push("/chat" as never)}
                >
                  {(members ?? []).length >= 3 ? "Open group chat" : "Open chat"}
                </Button>
              ) : null}

              <View className="flex-row gap-2 border-t border-gray-100 pt-4">
                {activeGroup.role === "owner" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    outline
                    className="flex-1"
                    loading={rotate.isPending}
                    icon={<ArrowsClockwiseIcon size={16} color="#374151" weight="bold" />}
                    onPress={() => confirmRotate(activeGroup.id)}
                  >
                    New code
                  </Button>
                ) : null}
                <Button
                  variant="danger"
                  size="sm"
                  outline
                  className="flex-1"
                  loading={leave.isPending}
                  icon={<SignOutIcon size={16} color="#e02020" weight="bold" />}
                  onPress={() => confirmLeave(activeGroup.id, activeGroup.name)}
                >
                  Leave
                </Button>
              </View>
            </Card>
          </Section>
        ) : null}

        {/* ── Other households ─────────────────────────────────────────── */}
        {groups.filter((group) => group.id !== activeGroup?.id).length > 0 ? (
          <Section title="Your other ledgers">
            <Card flush>
              {groups
                .filter((group) => group.id !== activeGroup?.id)
                .map((group, index, list) => (
                  <Row
                    key={group.id}
                    leading={
                      <IconTile color="#2a5298">
                        <HouseLineIcon size={20} color="#2a5298" weight="duotone" />
                      </IconTile>
                    }
                    title={group.name}
                    subtitle={`${group.memberCount} ${group.memberCount === 1 ? "person" : "people"} · code ${group.invite_code}`}
                    chevron
                    last={index === list.length - 1}
                    onPress={() => setScope({ kind: "group", groupId: group.id })}
                  />
                ))}
            </Card>
          </Section>
        ) : null}

        {/* ── Start or join ────────────────────────────────────────────── */}
        <Section title={groups.length === 0 ? "Get started" : "Add another"}>
          <Card flush>
            <Row
              leading={
                <IconTile color="#166b3f">
                  <UsersIcon size={20} color="#166b3f" weight="duotone" />
                </IconTile>
              }
              title="Create a household"
              subtitle="You'll get a code to invite your partner"
              chevron
              onPress={() => {
                setName("");
                setCurrencyCode(profile?.currency_code ?? currency);
                setFormError(null);
                setMode("create");
              }}
            />
            <Row
              leading={
                <IconTile color="#b45309">
                  <UserPlusIcon size={20} color="#b45309" weight="duotone" />
                </IconTile>
              }
              title="Join with a code"
              subtitle="Six characters from whoever invited you"
              chevron
              last
              onPress={() => {
                setCode("");
                setFormError(null);
                setMode("join");
              }}
            />
          </Card>
        </Section>

        <AppText className="px-2 text-xs leading-5 text-gray-400">
          A shared ledger is separate from your personal one. Anything you log while
          viewing the household is visible to everyone in it; your personal
          spending stays private.
        </AppText>
      </ScreenScroll>

      {/* ── Create ─────────────────────────────────────────────────────── */}
      <Sheet
        visible={mode === "create"}
        onClose={() => setMode("none")}
        title="New household"
        subtitle="Give it a name you'll both recognise."
        footer={
          <Button size="lg" loading={createGroup.isPending} onPress={submitCreate}>
            Create household
          </Button>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Input
            label="Name"
            placeholder="Home"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />

          <Pressable
            onPress={() => setCurrencyOpen(true)}
            className="will-change-pressable flex-row items-center justify-between rounded-2xl px-4 py-4 active:opacity-80"
            style={{ backgroundColor: colors.subtle }}
          >
            <View>
              <AppText
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: colors.muted }}
              >
                Currency
              </AppText>
              <AppText className="mt-1 text-[16px] font-semibold" style={{ color: colors.ink }}>
                {currencyCode} · {currencySymbol(currencyCode)}
              </AppText>
            </View>
            <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
              Change
            </AppText>
          </Pressable>

          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

      {/* ── Join ───────────────────────────────────────────────────────── */}
      <Sheet
        visible={mode === "join"}
        onClose={() => setMode("none")}
        title="Join a household"
        subtitle="Ask them to tap Share on their invite code."
        footer={
          <Button size="lg" loading={joinGroup.isPending} onPress={submitJoin}>
            Join
          </Button>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Input
            label="Invite code"
            placeholder="ABC123"
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            className="text-2xl font-bold tracking-[6px]"
            autoFocus
          />
          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

      {/* ── Rename ─────────────────────────────────────────────────────── */}
      <Sheet
        visible={mode === "rename"}
        onClose={() => setMode("none")}
        title="Rename household"
        footer={
          <Button size="lg" loading={rename.isPending} onPress={submitRename}>
            Save name
          </Button>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
          />
          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

      <Sheet
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        title="Household currency"
      >
        {CURRENCY_OPTIONS.map((option) => (
          <SheetOption
            key={option}
            label={option}
            description={currencySymbol(option)}
            selected={option === currencyCode}
            onPress={() => {
              setCurrencyCode(option);
              setCurrencyOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
