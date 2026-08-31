/**
 * lib/chat.tsx
 *
 * Realtime household chat: presence, typing, live messages, and unread badges.
 * One channel per group the signed-in user belongs to.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { fetchProfile, keys } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notifyChatMessage, registerPushToken, setViewingChatGroup } from "@/lib/notifications";
import { useScope } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import type { MessageRow } from "@/types/database";
import type { Member, MessageView } from "@/types/finance";
import { useQuery } from "@tanstack/react-query";

const READ_PREFIX = "duo-wallet.chat-read.";

interface ChatValue {
  /** Member ids currently connected on the active household. */
  onlineIds: ReadonlySet<string>;
  /** Other people typing in the active household. */
  typingIds: readonly string[];
  unreadByGroup: Record<string, number>;
  markRead: (groupId: string) => void;
  setTyping: (typing: boolean) => void;
  /** Call from the chat screen on focus/blur so banners stay quiet while reading. */
  setChatFocused: (groupId: string | null) => void;
}

const ChatContext = createContext<ChatValue | null>(null);

function appendMessage(queryClient: ReturnType<typeof useQueryClient>, row: MessageRow) {
  queryClient.setQueryData<MessageRow[]>(keys.messages(row.group_id), (prev) => {
    if (!prev) return [row];
    if (prev.some((item) => item.id === row.id)) return prev;
    return [...prev, row];
  });
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const { groups, scope, setScope } = useScope();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: keys.profile(user?.id ?? "anonymous"),
    queryFn: () => fetchProfile(user!.id),
    enabled: status === "signedIn" && Boolean(user),
    staleTime: 5 * 60_000,
  });

  const [onlineByGroup, setOnlineByGroup] = useState<Record<string, string[]>>({});
  const [typingByGroup, setTypingByGroup] = useState<Record<string, string[]>>({});
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const localTyping = useRef(false);
  const focusedChatRef = useRef<string | null>(null);

  const groupIds = useMemo(() => groups.map((group) => group.id).sort().join(","), [groups]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const activeGroupId = scope.kind === "group" ? scope.groupId : null;

  useEffect(() => {
    if (status !== "signedIn" || !user) return;
    void registerPushToken(user.id);
  }, [status, user]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type !== "chat" || typeof data.groupId !== "string") return;
      setScope({ kind: "group", groupId: data.groupId });
      router.navigate("/chat" as never);
    });
    return () => sub.remove();
  }, [setScope]);

  useEffect(() => {
    if (status !== "signedIn" || !user) return;

    const ids = groupIds.length === 0 ? [] : groupIds.split(",");
    const existing = channelsRef.current;
    const next = new Map<string, RealtimeChannel>();

    for (const groupId of ids) {
      const reuse = existing.get(groupId);
      if (reuse) {
        next.set(groupId, reuse);
        existing.delete(groupId);
        continue;
      }

      const topic = `chat:${groupId}`;

      // Defensive dedupe: Supabase's realtime client tracks channel
      // bindings by topic string, not by JS object identity. If anything
      // (a fast re-render, a provider remount, effect timing on a given
      // device) ever leads this effect to attempt building a channel for a
      // topic that's already registered with the client, calling .on()
      // on the new object throws "cannot add `presence` callbacks ...
      // after `subscribe()`" — and because that happens inside a
      // useEffect, not during render, it's invisible to React error
      // boundaries and crashes the whole app in a release build. Removing
      // any stray registration for this exact topic first makes channel
      // creation idempotent regardless of why this ran more than once.
      for (const stray of supabase().getChannels()) {
        if (stray.topic === `realtime:${topic}`) {
          void supabase().removeChannel(stray);
        }
      }

      try {
        const channel = supabase()
          .channel(topic, {
            config: {
              presence: { key: user.id },
              broadcast: { self: false },
            },
          })
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            setOnlineByGroup((prev) => ({ ...prev, [groupId]: Object.keys(state) }));
          })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            const otherId = typeof payload?.userId === "string" ? payload.userId : null;
            if (!otherId || otherId === user.id) return;
            const typing = Boolean(payload?.typing);
            setTypingByGroup((prev) => {
              const current = new Set(prev[groupId] ?? []);
              if (typing) current.add(otherId);
              else current.delete(otherId);
              return { ...prev, [groupId]: [...current] };
            });
            const timerKey = `${groupId}:${otherId}`;
            const prior = typingTimers.current.get(timerKey);
            if (prior) clearTimeout(prior);
            if (typing) {
              typingTimers.current.set(
                timerKey,
                setTimeout(() => {
                  setTypingByGroup((prev) => ({
                    ...prev,
                    [groupId]: (prev[groupId] ?? []).filter((id) => id !== otherId),
                  }));
                }, 3500),
              );
            }
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
              const row = payload.new as MessageRow;
              if (!row?.id) return;
              appendMessage(queryClient, row);
              if (row.user_id === user.id) return;

              const viewing = focusedChatRef.current === groupId;
              if (!viewing) {
                setUnreadByGroup((prev) => ({
                  ...prev,
                  [groupId]: (prev[groupId] ?? 0) + 1,
                }));
              }

              const members = queryClient.getQueryData<Member[]>(
                keys.members({ kind: "group", groupId }),
              );
              const sender = members?.find((member) => member.id === row.user_id);
              const household = groupsRef.current.find((group) => group.id === groupId);
              const groupChat = (household?.memberCount ?? 0) >= 3;
              void notifyChatMessage({
                groupId,
                title: groupChat
                  ? `${household?.name ?? "Household"} · ${sender?.name ?? "Someone"}`
                  : (sender?.name ?? "New message"),
                body: row.body,
              });
            },
          )
          .subscribe((channelStatus) => {
            if (channelStatus !== "SUBSCRIBED") return;
            void channel.track({
              user_id: user.id,
              name: profile?.display_name ?? "Me",
              color: profile?.color ?? "#2a5298",
              avatar_url: profile?.avatar_url ?? null,
              online_at: new Date().toISOString(),
            });
          });

        next.set(groupId, channel);
      } catch (err) {
        // useEffect errors are invisible to React error boundaries — they
        // bypass render entirely and crash the whole app in a release
        // build if left uncaught. Chat realtime is a nice-to-have; losing
        // live updates for one household is far better than the app
        // going down for everyone.
        console.warn("[chat] failed to set up realtime channel for", groupId, err);
      }
    }

    for (const stale of existing.values()) {
      void supabase().removeChannel(stale);
    }
    channelsRef.current = next;
  }, [status, user, groupIds, queryClient]);

  useEffect(() => {
    if (!user || !profile) return;
    for (const channel of channelsRef.current.values()) {
      void channel.track({
        user_id: user.id,
        name: profile.display_name,
        color: profile.color,
        avatar_url: profile.avatar_url,
        online_at: new Date().toISOString(),
      });
    }
  }, [user, profile]);

  useEffect(() => {
    return () => {
      for (const channel of channelsRef.current.values()) {
        void supabase().removeChannel(channel);
      }
      channelsRef.current.clear();
      for (const timer of typingTimers.current.values()) clearTimeout(timer);
    };
  }, []);

  const markRead = useCallback((groupId: string) => {
    setUnreadByGroup((prev) => ({ ...prev, [groupId]: 0 }));
    void AsyncStorage.setItem(READ_PREFIX + groupId, new Date().toISOString());
  }, []);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!activeGroupId) return;
      const channel = channelsRef.current.get(activeGroupId);
      if (!channel) return;
      if (localTyping.current === typing) return;
      localTyping.current = typing;
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user?.id, typing },
      });
    },
    [activeGroupId, user?.id],
  );

  const setChatFocused = useCallback(
    (groupId: string | null) => {
      focusedChatRef.current = groupId;
      setViewingChatGroup(groupId);
      if (groupId) markRead(groupId);
    },
    [markRead],
  );

  const value = useMemo<ChatValue>(() => {
    const onlineIds = new Set(activeGroupId ? (onlineByGroup[activeGroupId] ?? []) : []);
    const typingIds = activeGroupId ? (typingByGroup[activeGroupId] ?? []) : [];
    return {
      onlineIds,
      typingIds,
      unreadByGroup,
      markRead,
      setTyping,
      setChatFocused,
    };
  }, [
    activeGroupId,
    onlineByGroup,
    typingByGroup,
    unreadByGroup,
    markRead,
    setTyping,
    setChatFocused,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside <ChatProvider>");
  return value;
}

export function decorateMessages(rows: MessageRow[], members: Member[]): MessageView[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  return rows.map((row) => {
    const member = memberById.get(row.user_id);
    return {
      ...row,
      memberName: member?.isSelf ? "You" : (member?.name ?? "Someone"),
      memberColor: member?.color ?? "#6b7280",
      isSelf: member?.isSelf ?? false,
      avatarUrl: member?.avatarUrl ?? null,
    };
  });
}
