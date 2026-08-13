/**
 * app/(app)/import-mpesa.tsx
 *
 * Import M-Pesa confirmations: paste an SMS, or on Android read the inbox
 * after granting SMS permission.
 */

import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorNote,
  Header,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { useAuth } from "@/lib/auth";
import { defaultCategoryFor } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import { parseMpesaSms, type ParsedMpesa } from "@/lib/mpesa/parse";
import {
  canReadSmsNative,
  hasSmsPermission,
  listMpesaSms,
  requestSmsPermission,
  type SmsMessage,
} from "@/lib/mpesa/sms";
import { useAccounts, useCurrency, useSaveTransaction } from "@/lib/queries";
import { useScope } from "@/lib/scope";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChatTeardropTextIcon, ClipboardTextIcon, PlugsIcon } from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

export default function ImportMpesa() {
  const router = useRouter();
  const { user } = useAuth();
  const { scope } = useScope();
  const currency = useCurrency();
  const { accounts } = useAccounts();
  const save = useSaveTransaction();

  const [paste, setPaste] = useState("");
  const [parsed, setParsed] = useState<ParsedMpesa | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSms, setLoadingSms] = useState(false);

  const native = canReadSmsNative();

  const refreshInbox = useCallback(async () => {
    if (!native) return;
    setLoadingSms(true);
    try {
      const allowed = await hasSmsPermission();
      setPermission(allowed);
      if (!allowed) {
        setMessages([]);
        return;
      }
      setMessages(await listMpesaSms(30));
    } finally {
      setLoadingSms(false);
    }
  }, [native]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const askPermission = async () => {
    setError(null);
    const ok = await requestSmsPermission();
    setPermission(ok);
    if (!ok) {
      setError("SMS permission was denied. You can still paste an M-Pesa message below.");
      return;
    }
    await refreshInbox();
  };

  const previewPaste = () => {
    setError(null);
    const result = parseMpesaSms(paste);
    if (!result) {
      setParsed(null);
      setError("That doesn't look like an M-Pesa confirmation. Paste the full SMS.");
      return;
    }
    setParsed(result);
  };

  const saveParsed = async (item: ParsedMpesa) => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const mobile = accounts.find((account) => account.type === "mobile");
      await save.mutateAsync({
        draft: {
          kind: item.kind,
          amount: item.amount,
          feeAmount: item.feeAmount,
          categoryId: defaultCategoryFor(item.kind),
          accountId: mobile?.id ?? accounts[0]?.id ?? null,
          toAccountId: null,
          debtId: null,
          note: item.note,
          occurredAt: item.occurredAt ?? new Date().toISOString(),
          userId: user.id,
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      router.back();
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't save the M-Pesa entry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Import M-Pesa" subtitle="SMS → ledger" back />

      <ScreenScroll>
        {error ? <ErrorNote message={error} /> : null}

        {Platform.OS === "android" ? (
          <Section title="From your inbox">
            <Card>
              {!native ? (
                <Text className="text-sm text-muted">
                  Rebuild the app to enable inbox reading. Paste still works below.
                </Text>
              ) : permission !== true ? (
                <EmptyState
                  icon={<PlugsIcon size={28} color="#1e3a5f" weight="duotone" />}
                  title="Allow SMS access"
                  message="Duo Wallet only reads M-Pesa confirmations to log spending. Nothing is uploaded except what you save."
                  action={
                    <Button onPress={askPermission} loading={loadingSms}>
                      Allow SMS permission
                    </Button>
                  }
                />
              ) : messages.length === 0 ? (
                <Text className="text-sm text-muted">
                  {loadingSms
                    ? "Reading inbox…"
                    : "No recent M-Pesa messages found. Try paste instead."}
                </Text>
              ) : (
                <View className="gap-3">
                  {messages.map((message) => (
                    <Pressable
                      key={message.id}
                      onPress={() => message.parsed && void saveParsed(message.parsed)}
                      className="rounded-2xl border border-hairline bg-subtle px-4 py-3 active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {message.parsed?.note ?? "M-Pesa"}
                      </Text>
                      <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
                        {message.body}
                      </Text>
                      {message.parsed ? (
                        <Text className="mt-2 text-sm font-bold text-brand">
                          {message.parsed.kind === "income" ? "+" : "−"}
                          {formatMoney(message.parsed.amount, currency)}
                          {message.parsed.feeAmount > 0
                            ? ` · fee ${formatMoney(message.parsed.feeAmount, currency)}`
                            : ""}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                  <Button variant="secondary" onPress={refreshInbox} loading={loadingSms}>
                    Refresh inbox
                  </Button>
                </View>
              )}
            </Card>
          </Section>
        ) : null}

        <Section title="Paste an SMS">
          <Card className="gap-3">
            <Input
              label="M-Pesa message"
              placeholder="Paste the full confirmation SMS…"
              value={paste}
              onChangeText={setPaste}
              multiline
              numberOfLines={5}
            />
            <Button
              variant="secondary"
              onPress={previewPaste}
              icon={<ClipboardTextIcon size={18} color="#1e3a5f" weight="bold" />}
            >
              Parse message
            </Button>

            {parsed ? (
              <View className="gap-2 rounded-2xl bg-brand-soft px-4 py-3">
                <Text className="text-xs font-bold uppercase tracking-widest text-faint">
                  Ready to save
                </Text>
                <Text className="text-base font-semibold text-ink">{parsed.note}</Text>
                <Text className="text-sm text-muted">
                  {parsed.kind === "income" ? "Received" : "Spent"}{" "}
                  {formatMoney(parsed.amount, currency)}
                  {parsed.feeAmount > 0
                    ? ` · fee ${formatMoney(parsed.feeAmount, currency)} (counts as spending)`
                    : ""}
                </Text>
                <Button size="lg" loading={busy} onPress={() => void saveParsed(parsed)}>
                  Save to {scope.kind === "group" ? "household" : "personal"} ledger
                </Button>
              </View>
            ) : (
              <View className="flex-row items-start gap-2">
                <ChatTeardropTextIcon size={18} color="#9ca3af" />
                <Text className="flex-1 text-sm text-muted">
                  Fees in the SMS are recorded as spending automatically.
                </Text>
              </View>
            )}
          </Card>
        </Section>
      </ScreenScroll>
    </Screen>
  );
}
