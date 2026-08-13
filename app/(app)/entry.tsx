/**
 * app/(app)/entry.tsx
 *
 * Add or edit one transaction. Opened as a modal from the tab bar's plus button
 * (new) or by tapping a row (edit, via the `id` param).
 *
 * A transaction fee (M-Pesa charge, bank charge) is spending. It is stored on
 * the row as `fee_amount` and counted in every total. The moment is kept as
 * `occurred_at` — date and time — so a shared ledger stays accountable.
 */

import { CategoryBadge, CategoryGlyph } from "@/components/finance/category-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, IconTile, Row } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote, Header, Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { categoriesFor, defaultCategoryFor, getCategory } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { currencySymbol, formatMoney, parseAmount, toAmountInput } from "@/lib/currency";
import { addDays, isoAt, timeLabel, toDayKey, todayKey, whenLabel } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import {
  useAccounts,
  useCurrency,
  useDeleteTransaction,
  useMembers,
  useSaveTransaction,
  useTransaction,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowsLeftRightIcon,
  CalendarBlankIcon,
  CheckIcon,
  ReceiptIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
  WalletIcon,
} from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TransactionKind } from "@/types/database";

const KIND_OPTIONS: { value: TransactionKind; label: string }[] = [
  { value: "expense", label: "Spent" },
  { value: "income", label: "Received" },
  { value: "transfer", label: "Moved" },
];

type Picker = "none" | "category" | "account" | "toAccount" | "member" | "when" | "debt";

function nowDate(): Date {
  return new Date();
}

export default function Entry() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { scope } = useScope();
  const currency = useCurrency();

  const existing = useTransaction(id);
  const { accounts } = useAccounts();
  const { data: members } = useMembers();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  const isShared = scope.kind === "group";
  // Debts are optional on this screen — loading them eagerly crashed some
  // release builds when the RPC was slow or missing. Link a debt from Debts.
  const openDebts: { id: string; name: string; balance: number }[] = [];

  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amountText, setAmountText] = useState("");
  const [feeText, setFeeText] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryFor("expense"));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [debtId, setDebtId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(nowDate);
  const [note, setNote] = useState("");
  const [picker, setPicker] = useState<Picker>("none");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isEditing || hydrated || !existing.data) return;
    const row = existing.data;
    setKind(row.kind);
    setAmountText(toAmountInput(row.amount, currency));
    setFeeText(row.fee_amount > 0 ? toAmountInput(row.fee_amount, currency) : "");
    setCategoryId(row.category_id);
    setAccountId(row.account_id);
    setToAccountId(row.to_account_id);
    setDebtId(row.debt_id);
    setMemberId(row.user_id);
    setOccurredAt(new Date(row.occurred_at));
    setNote(row.note ?? "");
    setHydrated(true);
  }, [isEditing, hydrated, existing.data, currency]);

  useEffect(() => {
    if (accountId || accounts.length === 0 || (isEditing && !hydrated)) return;
    setAccountId(accounts[0].id);
  }, [accountId, accounts, isEditing, hydrated]);

  const categories = useMemo(() => categoriesFor(kind), [kind]);
  const amount = parseAmount(amountText, currency);
  const feeAmount = feeText ? (parseAmount(feeText, currency) ?? 0) : 0;
  const activeMemberId = memberId ?? user?.id ?? null;
  const selectedMember = members?.find((member) => member.id === activeMemberId);
  const fromAccount = accounts.find((account) => account.id === accountId);
  const toAccount = accounts.find((account) => account.id === toAccountId);
  const selectedDebt = openDebts.find((debt) => debt.id === debtId);
  const dayKey = toDayKey(occurredAt);

  const canSave =
    amount !== null &&
    amount > 0 &&
    Boolean(activeMemberId) &&
    (kind !== "transfer" || (accountId !== null && toAccountId !== null && accountId !== toAccountId));

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    const stillValid = getCategory(categoryId).applies === next;
    if (!stillValid) setCategoryId(defaultCategoryFor(next));
    if (next !== "expense") setDebtId(null);
  };

  const submit = async () => {
    if (!canSave || amount === null || !activeMemberId) return;
    setError(null);

    try {
      await save.mutateAsync({
        id,
        draft: {
          kind,
          amount,
          feeAmount: feeAmount > 0 ? feeAmount : 0,
          categoryId: kind === "transfer" ? "transfer" : categoryId,
          accountId,
          toAccountId,
          debtId: kind === "expense" ? debtId : null,
          note: note.trim() ? note.trim() : null,
          occurredAt: occurredAt.toISOString(),
          userId: activeMemberId,
        },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      router.back();
    } catch (cause) {
      setError(getErrorMessage(cause, "Couldn't save"));
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete this entry?", "It disappears for everyone on this ledger.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await remove.mutateAsync(id!);
            router.back();
          } catch (cause) {
            setError(getErrorMessage(cause, "Couldn't delete"));
          }
        },
      },
    ]);
  };

  const onPickWhen = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setPicker("none");
    if (event.type === "dismissed" || !date) return;
    setOccurredAt(date);
  };

  const jumpToDay = (key: string) => {
    setOccurredAt(new Date(isoAt(key, occurredAt.getHours(), occurredAt.getMinutes())));
  };

  return (
    <Screen className="bg-canvas">
      <Header
        title={isEditing ? "Edit entry" : "New entry"}
        back="close"
        right={
          isEditing ? (
            <Pressable
              onPress={confirmDelete}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-negative-soft active:opacity-80"
            >
              <TrashIcon size={18} color="#e02020" weight="bold" />
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Segmented
          options={KIND_OPTIONS}
          value={kind}
          onChange={changeKind}
          thumbColor={kind === "income" ? "#d6f0e0" : undefined}
        />

        <View className="items-center gap-1 rounded-3xl border border-hairline bg-subtle px-5 py-6">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            {kind === "income"
              ? "Amount received"
              : kind === "transfer"
                ? "Amount moved"
                : "Amount spent"}
          </Text>

          <View className="mt-1 flex-row items-center justify-center">
            <Text className="mr-1.5 text-2xl font-bold text-faint">
              {currencySymbol(currency)}
            </Text>
            <Input
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0"
              keyboardType="decimal-pad"
              autoFocus={!isEditing}
              wrapClassName="w-auto min-w-[140px] max-w-[240px]"
              className="text-center text-4xl font-bold tracking-tight text-ink"
              selectTextOnFocus
            />
          </View>

          {amount !== null ? (
            <Text className="text-sm text-muted">{formatMoney(amount, currency)}</Text>
          ) : (
            <Text className="text-sm text-faint">Type an amount</Text>
          )}
        </View>

        {/* Transaction cost is spending — always. */}
        {kind !== "income" ? (
          <Card>
            <View className="flex-row items-center gap-3">
              <IconTile color="#6b7280">
                <ReceiptIcon size={20} color="#6b7280" weight="duotone" />
              </IconTile>
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">Transaction fee</Text>
                <Text className="text-sm text-muted">
                  M-Pesa or bank charge. Counted as spending.
                </Text>
              </View>
              <View className="w-28">
                <Input
                  value={feeText}
                  onChangeText={setFeeText}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  className="text-right"
                />
              </View>
            </View>
            {feeAmount > 0 && amount !== null ? (
              <Text className="mt-3 text-sm text-muted">
                Total leaving account:{" "}
                <Text className="font-semibold text-ink">
                  {formatMoney(amount + feeAmount, currency)}
                </Text>
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Card flush>
          {kind === "transfer" ? (
            <>
              <Row
                leading={
                  <IconTile color="#6b7280">
                    <WalletIcon size={20} color="#6b7280" weight="duotone" />
                  </IconTile>
                }
                title="From"
                subtitle={fromAccount?.name ?? "Choose an account"}
                chevron
                onPress={() => setPicker("account")}
              />
              <Row
                leading={
                  <IconTile color="#2a5298">
                    <ArrowsLeftRightIcon size={20} color="#2a5298" weight="bold" />
                  </IconTile>
                }
                title="To"
                subtitle={toAccount?.name ?? "Choose an account"}
                chevron
                onPress={() => setPicker("toAccount")}
              />
            </>
          ) : (
            <>
              <Row
                leading={<CategoryBadge categoryId={categoryId} />}
                title="Category"
                subtitle={getCategory(categoryId).label}
                chevron
                onPress={() => setPicker("category")}
              />
              <Row
                leading={
                  <IconTile color={fromAccount?.color ?? "#6b7280"}>
                    <WalletIcon
                      size={20}
                      color={fromAccount?.color ?? "#6b7280"}
                      weight="duotone"
                    />
                  </IconTile>
                }
                title="Account"
                subtitle={
                  accounts.length === 0
                    ? "None yet — optional"
                    : (fromAccount?.name ?? "Not set")
                }
                chevron
                onPress={() => accounts.length > 0 && setPicker("account")}
              />
            </>
          )}

          {kind === "expense" && openDebts.length > 0 ? (
            <Row
              leading={
                <IconTile color="#9b0c0c">
                  <ReceiptIcon size={20} color="#9b0c0c" weight="duotone" />
                </IconTile>
              }
              title="Pays a debt"
              subtitle={selectedDebt?.name ?? "Optional"}
              chevron
              onPress={() => setPicker("debt")}
            />
          ) : null}

          {isShared ? (
            <Row
              leading={
                selectedMember ? (
                  <Avatar
                    name={selectedMember.name}
                    color={selectedMember.color}
                    size="md"
                  />
                ) : (
                  <IconTile color="#6366f1">
                    <UsersIcon size={20} color="#6366f1" weight="duotone" />
                  </IconTile>
                )
              }
              title="Who"
              subtitle={
                selectedMember?.isSelf ? "You" : (selectedMember?.name ?? "Choose a person")
              }
              chevron
              onPress={() => setPicker("member")}
            />
          ) : null}

          <Row
            leading={
              <IconTile color="#b45309">
                <CalendarBlankIcon size={20} color="#b45309" weight="duotone" />
              </IconTile>
            }
            title="When"
            subtitle={whenLabel(occurredAt.toISOString())}
            chevron
            last
            onPress={() => setPicker("when")}
          />
        </Card>

        <View className="flex-row gap-2">
          {[
            { label: "Today", key: todayKey() },
            { label: "Yesterday", key: addDays(todayKey(), -1) },
            { label: "2 days ago", key: addDays(todayKey(), -2) },
          ].map((option) => (
            <Pressable
              key={option.key}
              onPress={() => jumpToDay(option.key)}
              className={cn(
                "flex-1 items-center rounded-2xl border py-2.5",
                dayKey === option.key
                  ? "border-brand bg-brand-soft"
                  : "border-hairline bg-surface active:bg-subtle",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-semibold",
                  dayKey === option.key ? "text-brand" : "text-muted",
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Note"
          placeholder={kind === "income" ? "Salary, gift, refund…" : "What was it for?"}
          value={note}
          onChangeText={setNote}
          maxLength={120}
        />

        {error ? <ErrorNote message={error} /> : null}
      </ScrollView>

      <View
        className="border-t border-hairline bg-surface px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          size="lg"
          loading={save.isPending}
          disabled={!canSave}
          onPress={submit}
          haptic="medium"
          icon={<CheckIcon size={20} color="#fff" weight="bold" />}
        >
          {isEditing ? "Save changes" : "Add entry"}
        </Button>
        {kind === "transfer" && accountId && accountId === toAccountId ? (
          <Text className="mt-2 text-center text-xs text-negative">
            Pick two different accounts.
          </Text>
        ) : null}
      </View>

      <Sheet
        visible={picker === "category"}
        onClose={() => setPicker("none")}
        title="Category"
      >
        {categories.map((category) => (
          <SheetOption
            key={category.id}
            label={category.label}
            selected={category.id === categoryId}
            leading={
              <IconTile color={category.color}>
                <CategoryGlyph categoryId={category.id} size={20} />
              </IconTile>
            }
            onPress={() => {
              setCategoryId(category.id);
              setPicker("none");
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={picker === "account" || picker === "toAccount"}
        onClose={() => setPicker("none")}
        title={picker === "toAccount" ? "Move money to" : "Account"}
        subtitle={accounts.length === 0 ? "You haven't added any accounts yet." : undefined}
      >
        {accounts.map((account) => (
          <SheetOption
            key={account.id}
            label={account.name}
            description={formatMoney(account.balance, currency)}
            selected={
              picker === "toAccount" ? account.id === toAccountId : account.id === accountId
            }
            leading={
              <IconTile color={account.color}>
                <WalletIcon size={20} color={account.color} weight="duotone" />
              </IconTile>
            }
            onPress={() => {
              if (picker === "toAccount") setToAccountId(account.id);
              else setAccountId(account.id);
              setPicker("none");
            }}
          />
        ))}
        {kind !== "transfer" ? (
          <SheetOption
            label="No account"
            description="Just track the amount"
            selected={accountId === null}
            leading={
              <IconTile color="#9ca3af">
                <TagIcon size={20} color="#9ca3af" weight="duotone" />
              </IconTile>
            }
            onPress={() => {
              setAccountId(null);
              setPicker("none");
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={picker === "member"}
        onClose={() => setPicker("none")}
        title="Whose spending?"
        subtitle="Everyone on this ledger sees the entry either way."
      >
        {(members ?? []).map((member) => (
          <SheetOption
            key={member.id}
            label={member.isSelf ? "You" : member.name}
            selected={member.id === activeMemberId}
            leading={<Avatar name={member.name} color={member.color} size="md" />}
            onPress={() => {
              setMemberId(member.id);
              setPicker("none");
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={picker === "debt"}
        onClose={() => setPicker("none")}
        title="Pays which debt?"
      >
        <SheetOption
          label="None"
          description="Ordinary spending"
          selected={debtId === null}
          onPress={() => {
            setDebtId(null);
            setPicker("none");
          }}
        />
        {openDebts.map((debt) => (
          <SheetOption
            key={debt.id}
            label={debt.name}
            description={`${formatMoney(debt.balance, currency)} left`}
            selected={debt.id === debtId}
            onPress={() => {
              setDebtId(debt.id);
              setPicker("none");
            }}
          />
        ))}
      </Sheet>

      {picker === "when" && Platform.OS !== "ios" ? (
        <DateTimePicker
          value={occurredAt}
          mode="datetime"
          maximumDate={new Date()}
          onChange={onPickWhen}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Sheet
          visible={picker === "when"}
          onClose={() => setPicker("none")}
          title="When did it happen?"
          subtitle={`Time kept for accountability · ${timeLabel(occurredAt.toISOString())}`}
          footer={
            <Button variant="secondary" onPress={() => setPicker("none")}>
              Done
            </Button>
          }
        >
          <DateTimePicker
            value={occurredAt}
            mode="datetime"
            maximumDate={new Date()}
            display="spinner"
            onChange={onPickWhen}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}
