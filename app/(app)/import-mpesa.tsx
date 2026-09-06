/**
 * app/(app)/import-mpesa.tsx
 *
 * Import Safaricom wallet SMS (M-Pesa, Fuliza, M-Shwari, Ziidi, Pochi).
 * Rows are keyed by confirmation code so Fuliza's double SMS becomes one entry.
 * SMS only records amount/fee/code — the user must say what each was for.
 */

import { CategoryGlyph } from "@/components/finance/category-icon";
import { Button } from "@/components/ui/button";
import { Card, IconTile, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorNote,
  Header,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { SheetOption } from "@/components/ui/sheet";
import { FormSheet } from "@/components/ui/form-sheet";
import { useAuth } from "@/lib/auth";
import {
  categoriesFor,
  categoryNeedsDetail,
  composeCategoryNote,
  getCategory,
} from "@/lib/categories";
import { currentMonthKey, shortWhenLabel, whenLabel } from "@/lib/date";
import { formatMoney } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import {
  dedupeByMpesaCode,
  noteHasMpesaCode,
  parseMpesaSms,
  productHint,
  productLabel,
  type ParsedMpesa,
} from "@/lib/mpesa/parse";
import {
  canReadSmsNative,
  hasSmsPermission,
  listMpesaSms,
  requestSmsPermission,
  type SmsMessage,
} from "@/lib/mpesa/sms";
import { useAccounts, useCurrency, useSaveTransaction, useTransactions } from "@/lib/queries";
import { useScope } from "@/lib/scope";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChatTeardropTextIcon,
  ClipboardTextIcon,
  ClockCountdownIcon,
  PlusIcon,
  PlugsIcon,
} from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Platform, Pressable, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { Account } from "@/types/finance";
import type { TransactionKind } from "@/types/database";

const READ_FROM_KEY_PREFIX = "duo-wallet.mpesa-read-from.";

function pickAccount(accounts: Account[], product: ParsedMpesa["product"]): Account | null {
  const named = (needle: string) =>
    accounts.find((account) => account.name.toLowerCase().includes(needle));

  if (product === "mshwari") {
    return named("shwari") ?? named("m-shwari") ?? named("mpesa") ?? accounts[0] ?? null;
  }
  if (product === "ziidi") {
    return named("ziidi") ?? named("zidii") ?? named("mpesa") ?? accounts[0] ?? null;
  }
  if (product === "pochi") {
    return named("pochi") ?? named("biashara") ?? named("business") ?? named("mpesa") ?? accounts[0] ?? null;
  }
  return (
    accounts.find((account) => account.type === "mobile") ??
    named("mpesa") ??
    accounts[0] ??
    null
  );
}

function pickMpesaAccount(accounts: Account[]): Account | null {
  const named = (needle: string) =>
    accounts.find((account) => account.name.toLowerCase().includes(needle));
  return (
    accounts.find((account) => account.type === "mobile") ??
    named("mpesa") ??
    accounts[0] ??
    null
  );
}

function resolveAccounts(
  accounts: Account[],
  item: ParsedMpesa,
): { accountId: string | null; toAccountId: string | null; kind: TransactionKind } {
  const pocket = pickAccount(accounts, item.product);
  const mpesa = pickMpesaAccount(accounts);
  const toSavings =
    /transfer(?:red)?(?:\s+\S+){0,6}\s+to\s+(?:m-?shwari|ziidi|zidii)/i.test(item.raw) ||
    item.raw.toLowerCase().includes("deposited to") ||
    item.raw.toLowerCase().includes("saved to");
  const fromSavings =
    /transfer(?:red)?(?:\s+\S+){0,6}\s+from\s+(?:m-?shwari|ziidi|zidii)/i.test(item.raw) ||
    item.raw.toLowerCase().includes("withdrawn from");

  if (
    item.kind === "transfer" &&
    (item.product === "mshwari" || item.product === "ziidi") &&
    pocket &&
    mpesa &&
    pocket.id !== mpesa.id
  ) {
    if (toSavings) return { accountId: mpesa.id, toAccountId: pocket.id, kind: "transfer" };
    if (fromSavings) return { accountId: pocket.id, toAccountId: mpesa.id, kind: "transfer" };
  }

  if (item.kind === "transfer") {
    if (fromSavings) {
      return { accountId: pocket?.id ?? mpesa?.id ?? null, toAccountId: null, kind: "income" };
    }
    return { accountId: pocket?.id ?? mpesa?.id ?? null, toAccountId: null, kind: "expense" };
  }

  return {
    accountId: pickAccount(accounts, item.product)?.id ?? null,
    toAccountId: null,
    kind: item.kind,
  };
}

export default function ImportMpesa() {
  const router = useRouter();
  const { user } = useAuth();
  const { scope } = useScope();
  const currency = useCurrency();
  const { accounts } = useAccounts();
  const save = useSaveTransaction();
  const recent = useTransactions(currentMonthKey());

  const [paste, setPaste] = useState("");
  const [pending, setPending] = useState<ParsedMpesa | null>(null);
  const [pendingWhen, setPendingWhen] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSms, setLoadingSms] = useState(false);
  /** Only read SMS from this point on, epoch ms. `null` = no cutoff. */
  const [readFrom, setReadFrom] = useState<number | null>(null);
  const [readFromLoaded, setReadFromLoaded] = useState(false);

  const native = canReadSmsNative();

  // Load the remembered cutoff once we know who's signed in, so it doesn't
  // briefly flash "no cutoff" before defaulting back to the saved choice.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem(READ_FROM_KEY_PREFIX + user.id).catch(() => null);
      if (cancelled) return;
      const parsed = raw ? Number(raw) : NaN;
      setReadFrom(Number.isFinite(parsed) ? parsed : null);
      setReadFromLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const importedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const row of recent.data ?? []) {
      const match = row.note?.match(/\bRef\s+([A-Z0-9]{10})\b/i);
      if (match) codes.add(match[1].toUpperCase());
    }
    return codes;
  }, [recent.data]);

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
      setMessages(await listMpesaSms(40, readFrom ?? undefined));
    } finally {
      setLoadingSms(false);
    }
  }, [native, readFrom]);

  useEffect(() => {
    // Wait for the persisted cutoff to load first, so we don't fetch once
    // with no cutoff and again a moment later once it loads.
    if (!readFromLoaded) return;
    void refreshInbox();
  }, [refreshInbox, readFromLoaded]);

  const persistReadFrom = async (next: number | null) => {
    setReadFrom(next);
    if (!user) return;
    const key = READ_FROM_KEY_PREFIX + user.id;
    if (next === null) await AsyncStorage.removeItem(key).catch(() => {});
    else await AsyncStorage.setItem(key, String(next)).catch(() => {});
  };

  const openReadFromPicker = () => {
    // Same imperative date-then-time chaining as app/(app)/entry.tsx — the
    // declarative <DateTimePicker> crashes on unmount on some Android
    // versions, so this app never uses it directly on Android.
    const base = readFrom ? new Date(readFrom) : new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: "date",
      maximumDate: new Date(),
      onValueChange: (_event, pickedDate) => {
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: "time",
          onValueChange: (_timeEvent, pickedTime) => {
            void persistReadFrom(pickedTime.getTime());
          },
        });
      },
    });
  };

  const clearReadFrom = () => void persistReadFrom(null);

  const openCategorize = (item: ParsedMpesa) => {
    setError(null);
    setPending(item);
    setPendingWhen(item.occurredAt ? new Date(item.occurredAt) : new Date());
    setCategoryId(item.suggestedCategoryId);
    setOtherDetail("");
  };

  const closeCategorize = () => {
    setPending(null);
    setCategoryId(null);
    setOtherDetail("");
  };

  // Same imperative date-then-time chaining used elsewhere in this app
  // (entry.tsx, the read-from picker above) — the declarative
  // <DateTimePicker> crashes on unmount on some Android versions.
  const openWhenPicker = () => {
    DateTimePickerAndroid.open({
      value: pendingWhen,
      mode: "date",
      maximumDate: new Date(),
      onValueChange: (_event, pickedDate) => {
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: "time",
          onValueChange: (_timeEvent, pickedTime) => setPendingWhen(pickedTime),
        });
      },
    });
  };

  const askPermission = async () => {
    setError(null);
    const ok = await requestSmsPermission();
    setPermission(ok);
    if (!ok) {
      setError("SMS permission denied. Paste a message below, or add manually.");
      return;
    }
    await refreshInbox();
  };

  const previewPaste = () => {
    setError(null);
    const result = parseMpesaSms(paste);
    if (!result) {
      setError("That doesn't look like an M-Pesa / M-Shwari / Ziidi / Pochi SMS.");
      return;
    }
    const lines = paste
      .split(/\n{2,}/)
      .map((chunk) => parseMpesaSms(chunk))
      .filter((item): item is ParsedMpesa => item !== null);
    const unique = lines.length > 1 ? dedupeByMpesaCode(lines) : [result];
    openCategorize(unique[0]!);
  };

  const alreadyImported = (item: ParsedMpesa) =>
    Boolean(item.reference && importedCodes.has(item.reference));

  const resolvedKind: TransactionKind = pending
    ? resolveAccounts(accounts, pending).kind
    : "expense";
  const categoryOptions = categoriesFor(
    resolvedKind === "transfer" ? "expense" : resolvedKind,
  );

  const canConfirm =
    Boolean(pending) &&
    Boolean(categoryId) &&
    (!categoryNeedsDetail(categoryId!) || otherDetail.trim().length > 0);

  const saveCategorized = async () => {
    if (!user || !pending || !categoryId) return;
    if (pending.reference && alreadyImported(pending)) {
      setError(`Ref ${pending.reference} is already on this month's ledger.`);
      return;
    }
    if (
      pending.reference &&
      (recent.data ?? []).some((row) => noteHasMpesaCode(row.note, pending.reference!))
    ) {
      setError(`Ref ${pending.reference} is already saved.`);
      return;
    }
    if (categoryNeedsDetail(categoryId) && !otherDetail.trim()) {
      setError("Say what “Other” is — e.g. church, chama, school trip.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const resolved = resolveAccounts(accounts, pending);
      const finalCategory =
        resolved.kind === "transfer"
          ? "transfer"
          : categoryId;
      const note = composeCategoryNote(finalCategory, otherDetail, pending.note);

      await save.mutateAsync({
        draft: {
          kind: resolved.kind,
          amount: pending.amount,
          feeAmount: pending.feeAmount,
          categoryId: finalCategory,
          accountId: resolved.accountId,
          toAccountId: resolved.toAccountId,
          debtId: null,
          note,
          occurredAt: pendingWhen.toISOString(),
          userId: user.id,
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      closeCategorize();
      await refreshInbox();
      if (recent.refetch) void recent.refetch();
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't save the entry"));
    } finally {
      setBusy(false);
    }
  };

  const visibleMessages = messages.filter(
    (message) => !alreadyImported(message.parsed),
  );

  return (
    <Screen>
      <Header title="Import M-Pesa" subtitle="You choose the category" back />

      <ScreenScroll>
        {error ? <ErrorNote message={error} /> : null}

        <Card className="gap-3">
          <AppText className="text-sm leading-5 text-muted">
            Fuliza is debt (overdraft). M-Shwari and Ziidi are savings. Pochi la
            Biashara is business. We record the SMS by code — you say what each
            one was for before it hits the ledger.
          </AppText>
          <Button
            variant="secondary"
            onPress={() => router.push("/entry")}
            icon={<PlusIcon size={18} color="#1e3a5f" weight="bold" />}
          >
            Add manually instead
          </Button>
        </Card>

        {Platform.OS === "android" ? (
          <Section title="From your inbox">
            <Card>
              {!native ? (
                <AppText className="text-sm text-muted">
                  Rebuild the app to enable inbox reading. Paste or add manually
                  still works.
                </AppText>
              ) : permission !== true ? (
                <EmptyState
                  icon={<PlugsIcon size={28} color="#1e3a5f" weight="duotone" />}
                  title="Allow SMS access"
                  message="Optional. We group by confirmation code, then you categorize each one."
                  action={
                    <View className="gap-2">
                      <Button onPress={askPermission} loading={loadingSms}>
                        Allow SMS permission
                      </Button>
                      <Button variant="secondary" onPress={() => router.push("/entry")}>
                        Skip — add manually
                      </Button>
                    </View>
                  }
                />
              ) : (
                <View className="gap-3">
                  <View className="flex-row items-center gap-2 rounded-2xl border border-hairline bg-subtle px-4 py-3">
                    <ClockCountdownIcon size={20} color="#9ca3af" />
                    <View className="flex-1">
                      <AppText className="text-[10px] font-bold uppercase tracking-wider text-faint">
                        Reading since
                      </AppText>
                      <AppText className="mt-0.5 text-sm font-semibold text-ink">
                        {readFrom ? shortWhenLabel(new Date(readFrom).toISOString()) : "All messages"}
                      </AppText>
                    </View>
                    <Pressable
                      onPress={openReadFromPicker}
                      className="rounded-full bg-brand-soft px-3 py-1.5 active:opacity-80"
                    >
                      <AppText className="text-xs font-bold text-brand">Change</AppText>
                    </Pressable>
                    {readFrom ? (
                      <Pressable
                        onPress={clearReadFrom}
                        className="rounded-full bg-subtle px-3 py-1.5 active:opacity-80"
                      >
                        <AppText className="text-xs font-bold text-muted">Clear</AppText>
                      </Pressable>
                    ) : null}
                  </View>

                  {visibleMessages.length === 0 ? (
                    <AppText className="text-sm text-muted">
                      {loadingSms
                        ? "Reading inbox…"
                        : "No new wallet SMS in that range (or already imported). Paste below or add manually."}
                    </AppText>
                  ) : (
                    <>
                      {visibleMessages.map((message) => (
                        <Pressable
                          key={message.id}
                          onPress={() => openCategorize(message.parsed)}
                          className="rounded-2xl border border-hairline bg-subtle px-4 py-3 active:opacity-80"
                        >
                          <View className="flex-row items-center justify-between gap-2">
                            <AppText className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
                              {message.parsed.note}
                            </AppText>
                            <AppText className="text-[10px] font-bold uppercase tracking-wider text-faint">
                              {productLabel(message.parsed.product)}
                            </AppText>
                          </View>
                          <AppText className="mt-1 text-xs text-brand">
                            {productHint(message.parsed.product)}
                          </AppText>
                          <AppText className="mt-1 text-[11px] text-faint">
                            {shortWhenLabel(new Date(message.date).toISOString())}
                          </AppText>
                          {message.parsed.reference ? (
                            <AppText className="mt-1 text-xs font-semibold text-muted">
                              Code {message.parsed.reference}
                            </AppText>
                          ) : null}
                          <AppText className="mt-2 text-sm font-bold text-brand">
                            {message.parsed.kind === "income" ? "+" : "−"}
                            {formatMoney(message.parsed.amount, currency)}
                            {message.parsed.feeAmount > 0
                              ? ` · fee ${formatMoney(message.parsed.feeAmount, currency)}`
                              : ""}
                          </AppText>
                        </Pressable>
                      ))}
                    </>
                  )}

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
              label="Wallet message"
              placeholder="Paste M-Pesa, Fuliza, M-Shwari, Ziidi or Pochi SMS…"
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
              Parse & categorize
            </Button>
            <View className="flex-row items-start gap-2">
              <ChatTeardropTextIcon size={18} color="#9ca3af" />
              <AppText className="flex-1 text-sm text-muted">
                Tip: name accounts &quot;M-Pesa&quot;, &quot;M-Shwari&quot;, &quot;Ziidi&quot; or
                &quot;Pochi&quot; so amounts land in the right pocket.
              </AppText>
            </View>
          </Card>
        </Section>
      </ScreenScroll>

      <FormSheet
        visible={pending !== null}
        onClose={closeCategorize}
        title="What was this for?"
        subtitle={
          pending
            ? `${productLabel(pending.product)} · ${formatMoney(pending.amount, currency)}`
            : undefined
        }
        footer={
          <Button
            size="lg"
            loading={busy}
            disabled={!canConfirm}
            onPress={() => void saveCategorized()}
          >
            Save to {scope.kind === "group" ? "household" : "personal"} ledger
          </Button>
        }
      >
        {pending ? (
          <View className="gap-3 px-1 pb-2">
            <AppText className="text-sm text-muted">{productHint(pending.product)}</AppText>
            <AppText className="text-sm font-semibold text-ink">{pending.note}</AppText>

            <Pressable
              onPress={openWhenPicker}
              className="flex-row items-center gap-2 rounded-2xl border border-hairline bg-subtle px-4 py-3 active:opacity-80"
            >
              <ClockCountdownIcon size={18} color="#9ca3af" />
              <View className="flex-1">
                <AppText className="text-[10px] font-bold uppercase tracking-wider text-faint">
                  When
                </AppText>
                <AppText className="mt-0.5 text-sm font-semibold text-ink">
                  {whenLabel(pendingWhen.toISOString())}
                </AppText>
              </View>
              <AppText className="text-xs font-bold text-brand">Change</AppText>
            </Pressable>

            {pending.suggestedCategoryId ? (
              <Pressable
                onPress={() => setCategoryId(pending.suggestedCategoryId)}
                className="rounded-2xl border border-brand bg-brand-soft px-4 py-3 active:opacity-80"
              >
                <AppText className="text-xs font-bold uppercase tracking-wider text-faint">
                  Suggested
                </AppText>
                <AppText className="mt-0.5 text-sm font-semibold text-brand">
                  {getCategory(pending.suggestedCategoryId).label}
                </AppText>
              </Pressable>
            ) : null}

            <View className="gap-1">
              {categoryOptions.map((category) => (
                <SheetOption
                  key={category.id}
                  label={category.label}
                  selected={category.id === categoryId}
                  leading={
                    <IconTile color={category.color}>
                      <CategoryGlyph categoryId={category.id} size={20} />
                    </IconTile>
                  }
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </View>

            {categoryId && categoryNeedsDetail(categoryId) ? (
              <Input
                label="What is it?"
                placeholder="e.g. Church offering, chama, school trip"
                value={otherDetail}
                onChangeText={setOtherDetail}
                required
                autoFocus
              />
            ) : null}
          </View>
        ) : null}
      </FormSheet>
    </Screen>
  );
}
