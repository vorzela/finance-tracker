/**
 * app/(app)/(tabs)/chat.tsx
 *
 * Household thread. Two people get a 1:1 chat; three or more get a group chat
 * with names on bubbles, online dots, and typing.
 */

import { LedgerSwitcher } from "@/components/finance/ledger-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Header, Screen } from "@/components/ui/screen";
import { ActivitySkeleton } from "@/components/ui/shimmer";
import { decorateMessages, useChat } from "@/lib/chat";
import { timeLabel } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import { activeFontFamily } from "@/lib/font-runtime";
import { useMembers, useMessages, useSendMessage } from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChatCircleIcon,
  PaperPlaneTiltIcon,
  UsersIcon,
} from "phosphor-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import {
  FlatList,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import type { MessageView } from "@/types/finance";

export default function Chat() {
  const { scope, activeGroup } = useScope();
  const { data: members = [] } = useMembers();
  const colors = useThemeColors();
  const router = useRouter();
  const { setChatFocused, setTyping, onlineIds, typingIds } = useChat();

  const groupId = scope.kind === "group" ? scope.groupId : null;
  const messagesQuery = useMessages(groupId);
  const send = useSendMessage();

  const [draft, setDraft] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const others = members.filter((member) => !member.isSelf);
  const isGroupChat = members.length >= 3;
  const counterpart = others[0];

  useFocusEffect(
    useCallback(() => {
      if (groupId) setChatFocused(groupId);
      return () => {
        setChatFocused(null);
        setTyping(false);
        if (typingTimer.current) clearTimeout(typingTimer.current);
      };
    }, [groupId, setChatFocused, setTyping]),
  );

  const views = useMemo(
    () => decorateMessages(messagesQuery.data ?? [], members),
    [messagesQuery.data, members],
  );

  const inverted = useMemo(() => [...views].reverse(), [views]);

  const onlineOthers = others.filter((member) => onlineIds.has(member.id));
  const typingNames = others
    .filter((member) => typingIds.includes(member.id))
    .map((member) => member.name.split(" ")[0]);

  const title = !groupId
    ? "Chat"
    : isGroupChat
      ? (activeGroup?.name ?? "Group chat")
      : (counterpart?.name ?? activeGroup?.name ?? "Chat");

  const subtitle = !groupId
    ? "Shared ledgers only"
    : members.length < 2
      ? "Invite someone to start chatting"
      : typingNames.length > 0
        ? typingLine(typingNames)
        : onlineOthers.length === 0
          ? "Offline"
          : isGroupChat
            ? `${onlineOthers.length} online`
            : "Online";

  const onChangeDraft = (value: string) => {
    setDraft(value);
    if (!groupId) return;
    setTyping(value.trim().length > 0);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1600);
  };

  const submit = async () => {
    if (!groupId || !draft.trim() || send.isPending) return;
    const body = draft;
    setDraft("");
    setTyping(false);
    try {
      await send.mutateAsync({ groupId, body });
    } catch {
      setDraft(body);
    }
  };

  if (scope.kind !== "group") {
    return (
      <Screen>
        <Header title="Chat" subtitle="Shared ledgers" right={<LedgerSwitcher />} large={false} />
        <EmptyState
          icon={<ChatCircleIcon size={28} color={colors.brand} weight="duotone" />}
          title="Chat is for households"
          message="Switch to a shared ledger, or create one and invite your partner with a code."
          action={
            <Button size="lg" onPress={() => router.push("/household")}>
              Household
            </Button>
          }
        />
      </Screen>
    );
  }

  if (members.length < 2) {
    return (
      <Screen>
        <Header title={title} subtitle={subtitle} right={<LedgerSwitcher />} large={false} />
        <EmptyState
          icon={<UsersIcon size={28} color={colors.brand} weight="duotone" />}
          title="Waiting on someone else"
          message="Share the invite code. Chat opens once two of you are in this household — three or more becomes a group chat."
          action={
            <Button size="lg" onPress={() => router.push("/household")}>
              Invite
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={title}
        subtitle={subtitle}
        right={<LedgerSwitcher />}
        large={false}
      />

      <View className="flex-row items-center gap-2 px-5 pb-2">
        {others.slice(0, 5).map((member) => (
          <View key={member.id} className="items-center gap-1">
            <View>
              <Avatar
                name={member.name}
                color={member.color}
                uri={member.avatarUrl}
                size="sm"
              />
              <View
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2"
                style={{
                  backgroundColor: onlineIds.has(member.id)
                    ? colors.positive
                    : colors.faint,
                  borderColor: colors.canvas,
                }}
              />
            </View>
          </View>
        ))}
        {isGroupChat ? (
          <AppText className="ml-1 text-[12px] text-muted">Group chat</AppText>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        {messagesQuery.isPending && !messagesQuery.data ? (
          <View className="flex-1 px-5">
            <ActivitySkeleton />
          </View>
        ) : messagesQuery.error && !messagesQuery.data ? (
          <View className="flex-1 px-5 pt-4">
            <Card>
              <EmptyState
                icon={<ChatCircleIcon size={28} color={colors.brand} weight="duotone" />}
                title="Couldn't load chat"
                message={getErrorMessage(messagesQuery.error, "load the chat")}
                action={
                  <Button size="lg" onPress={() => void messagesQuery.refetch()}>
                    Try again
                  </Button>
                }
              />
            </Card>
          </View>
        ) : (
          <FlatList
            data={inverted}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
              gap: 8,
              flexGrow: 1,
            }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="scale-y-[-1]">
                <Card>
                  <EmptyState
                    icon={<ChatCircleIcon size={28} color={colors.brand} weight="duotone" />}
                    title="Say hello"
                    message={
                      isGroupChat
                        ? "This is the household thread. Everyone in it sees every message."
                        : `Only you and ${counterpart?.name ?? "them"} see this.`
                    }
                  />
                </Card>
              </View>
            }
            renderItem={({ item, index }) => (
              <Bubble
                message={item}
                showName={isGroupChat}
                showTime={
                  index === 0 ||
                  inverted[index - 1]?.user_id !== item.user_id ||
                  minuteKey(inverted[index - 1]?.created_at) !== minuteKey(item.created_at)
                }
              />
            )}
          />
        )}

        {typingNames.length > 0 ? (
          <AppText className="px-5 pb-1 text-[12px] text-muted">
            {typingLine(typingNames)}
          </AppText>
        ) : null}

        <View
          className="flex-row items-end gap-2 px-4 pt-2"
          style={{ paddingBottom: 10 }}
        >
          <View
            className="min-h-11 flex-1 justify-center rounded-[22px] px-4 py-2"
            style={{ backgroundColor: colors.subtle }}
          >
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder="Message"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={2000}
              style={{
                fontFamily: activeFontFamily({ fontWeight: "400" }),
                fontSize: 16,
                color: colors.ink,
                maxHeight: 120,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            />
          </View>
          <Pressable
            onPress={() => void submit()}
            disabled={!draft.trim() || send.isPending}
            className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
            style={{
              backgroundColor: draft.trim() ? colors.brand : colors.subtle,
            }}
            accessibilityLabel="Send"
          >
            <PaperPlaneTiltIcon
              size={18}
              color={draft.trim() ? colors.onBrand : colors.faint}
              weight="fill"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {send.error ? (
        <AppText className="px-5 pb-2 text-center text-[12px] text-negative">
          {getErrorMessage(send.error, "Couldn't send")}
        </AppText>
      ) : null}
    </Screen>
  );
}

function minuteKey(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function typingLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

function Bubble({
  message,
  showName,
  showTime,
}: {
  message: MessageView;
  showName: boolean;
  showTime: boolean;
}) {
  const colors = useThemeColors();
  const mine = message.isSelf;

  return (
    <View className={`max-w-[82%] ${mine ? "self-end" : "self-start"}`}>
      {showName && !mine ? (
        <AppText className="mb-0.5 ml-1 text-[11px] font-semibold text-muted">
          {message.memberName}
        </AppText>
      ) : null}
      <View
        className="rounded-[20px] px-3.5 py-2.5"
        style={{
          backgroundColor: mine ? colors.brand : colors.surface,
          borderBottomRightRadius: mine ? 6 : 20,
          borderBottomLeftRadius: mine ? 20 : 6,
        }}
      >
        <AppText
          className="text-[15px] leading-5"
          style={{ color: mine ? colors.onBrand : colors.ink }}
        >
          {message.body}
        </AppText>
      </View>
      {showTime ? (
        <AppText
          className={`mt-0.5 text-[10px] text-faint ${mine ? "text-right" : "text-left"}`}
        >
          {timeLabel(message.created_at)}
        </AppText>
      ) : null}
    </View>
  );
}
