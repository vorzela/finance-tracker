/**
 * app/(app)/debts.tsx
 *
 * What you owe and what is owed to you. Paying one down is ordinary spending
 * tagged to the debt from the entry screen — the outstanding balance is always
 * derived, never typed in by hand.
 */

import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorNote,
  Header,
  LoadingState,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { currencySymbol, formatMoney, parseAmount, toAmountInput } from "@/lib/currency";
import { shortDayLabel } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import {
  useCurrency,
  useDebts,
  useDeleteDebt,
  useSaveDebt,
  useSetDebtClosed,
} from "@/lib/queries";
import { useScopeLabel } from "@/lib/scope";
import {
  CheckCircleIcon,
  PlusIcon,
  ScalesIcon,
  TrashIcon,
} from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";
import type { DebtDirection } from "@/types/database";
import type { DebtView } from "@/types/finance";

const DIRECTION_OPTIONS: { value: DebtDirection; label: string }[] = [
  { value: "owed_by_me", label: "I owe" },
  { value: "owed_to_me", label: "Owed to me" },
];

export default function Debts() {
  const currency = useCurrency();
  const ledger = useScopeLabel();
  const { debts, isLoading, error, refetch } = useDebts();
  const saveDebt = useSaveDebt();
  const setClosed = useSetDebtClosed();
  const remove = useDeleteDebt();

  const [editing, setEditing] = useState<DebtView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("owed_by_me");
  const [counterparty, setCounterparty] = useState("");
  const [principalText, setPrincipalText] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const open = useMemo(() => debts.filter((debt) => !debt.closed), [debts]);
  const closed = useMemo(() => debts.filter((debt) => debt.closed), [debts]);

  const iOwe = open
    .filter((debt) => debt.direction === "owed_by_me")
    .reduce((sum, debt) => sum + debt.balance, 0);
  const owedToMe = open
    .filter((debt) => debt.direction === "owed_to_me")
    .reduce((sum, debt) => sum + debt.balance, 0);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDirection("owed_by_me");
    setCounterparty("");
    setPrincipalText("");
    setNote("");
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (debt: DebtView) => {
    setEditing(debt);
    setName(debt.name);
    setDirection(debt.direction);
    setCounterparty(debt.counterparty ?? "");
    setPrincipalText(toAmountInput(debt.principal, currency));
    setNote(debt.note ?? "");
    setFormError(null);
    setSheetOpen(true);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      setFormError("Give the debt a name.");
      return;
    }
    const principal = parseAmount(principalText, currency);
    if (principal === null || principal <= 0) {
      setFormError("Enter how much is owed.");
      return;
    }

    try {
      await saveDebt.mutateAsync({
        id: editing?.id,
        draft: {
          name,
          direction,
          counterparty: counterparty.trim() || null,
          principal,
          dueOn: editing?.due_on ?? null,
          note: note.trim() || null,
        },
      });
      setSheetOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't save the debt"));
    }
  };

  const confirmDelete = (debt: DebtView) => {
    Alert.alert(`Remove ${debt.name}?`, "Past repayments stay in the ledger.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void remove.mutateAsync(debt.id).catch(() => {}),
      },
    ]);
  };

  return (
    <Screen>
      <Header
        title="Debts"
        subtitle={ledger}
        back
        right={
          <Pressable
            onPress={openNew}
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-full bg-navy-600 active:bg-navy-700"
          >
            <PlusIcon size={20} color="#fff" weight="bold" />
          </Pressable>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <ScreenScroll onRefresh={() => void refetch()}>
          {error ? (
            <ErrorNote message={error.message} onRetry={() => void refetch()} />
          ) : null}

          {debts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ScalesIcon size={28} color="#1e3a5f" weight="duotone" />}
                title="No debts tracked"
                message="Add a loan, shop credit or money a friend owes you. Repay from the entry screen."
                action={
                  <Button onPress={openNew} icon={<PlusIcon size={20} color="#fff" weight="bold" />}>
                    Add a debt
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <View className="flex-row gap-3">
                <Card className="flex-1">
                  <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                    You owe
                  </AppText>
                  <Money amount={iOwe} currency={currency} size="lg" className="mt-1 text-negative" />
                </Card>
                <Card className="flex-1">
                  <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                    Owed to you
                  </AppText>
                  <Money
                    amount={owedToMe}
                    currency={currency}
                    size="lg"
                    className="mt-1 text-positive"
                  />
                </Card>
              </View>

              <Section title="Open">
                <Card flush>
                  {open.map((debt, index) => (
                    <Pressable
                      key={debt.id}
                      onPress={() => openEdit(debt)}
                      className={`px-5 py-4 active:bg-subtle ${
                        index === open.length - 1 ? "" : "border-b border-hairline"
                      }`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <AppText className="text-base font-semibold text-ink">{debt.name}</AppText>
                          <AppText className="mt-0.5 text-sm text-muted">
                            {debt.direction === "owed_by_me" ? "You owe" : "Owes you"}
                            {debt.counterparty ? ` · ${debt.counterparty}` : ""}
                            {debt.due_on ? ` · due ${shortDayLabel(debt.due_on)}` : ""}
                          </AppText>
                        </View>
                        <Money amount={debt.balance} currency={currency} />
                      </View>
                      <ProgressBar ratio={debt.progress} className="mt-3" height={6} />
                      <AppText className="mt-1.5 text-xs text-faint">
                        {formatMoney(debt.paid, currency)} of{" "}
                        {formatMoney(debt.principal, currency)} paid
                      </AppText>
                      <View className="mt-3 flex-row gap-2">
                        <Pressable
                          onPress={() =>
                            void setClosed.mutateAsync({ id: debt.id, closed: true })
                          }
                          className="flex-row items-center gap-1.5 rounded-full bg-positive-soft px-3 py-1.5"
                        >
                          <CheckCircleIcon size={14} color="#1f9155" weight="bold" />
                          <AppText className="text-xs font-semibold text-positive">Mark settled</AppText>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(debt)}
                          className="flex-row items-center gap-1.5 rounded-full bg-negative-soft px-3 py-1.5"
                        >
                          <TrashIcon size={14} color="#e02020" weight="bold" />
                          <AppText className="text-xs font-semibold text-negative">Remove</AppText>
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                  {open.length === 0 ? (
                    <AppText className="px-5 py-6 text-center text-sm text-muted">
                      Nothing open right now.
                    </AppText>
                  ) : null}
                </Card>
              </Section>

              {closed.length > 0 ? (
                <Section title="Settled">
                  <Card flush>
                    {closed.map((debt, index) => (
                      <Pressable
                        key={debt.id}
                        onPress={() =>
                          void setClosed.mutateAsync({ id: debt.id, closed: false })
                        }
                        className={`flex-row items-center justify-between px-5 py-3.5 ${
                          index === closed.length - 1 ? "" : "border-b border-hairline"
                        }`}
                      >
                        <AppText className="text-sm text-muted">{debt.name}</AppText>
                        <AppText className="text-xs font-semibold text-positive">Reopen</AppText>
                      </Pressable>
                    ))}
                  </Card>
                </Section>
              ) : null}
            </>
          )}
        </ScreenScroll>
      )}

      <Sheet
        keyboardAware
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit debt" : "New debt"}
        footer={
          <Button size="lg" loading={saveDebt.isPending} onPress={submit}>
            {editing ? "Save" : "Add debt"}
          </Button>
        }
      >
        <View className="gap-4 px-1 pb-2">
          <Segmented
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={setDirection}
          />
          <Input
            label="Name"
            placeholder="Salary advance, shop credit…"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="With whom"
            placeholder="Optional"
            value={counterparty}
            onChangeText={setCounterparty}
          />
          <Input
            label={`Amount (${currencySymbol(currency)})`}
            placeholder="0"
            keyboardType="decimal-pad"
            value={principalText}
            onChangeText={setPrincipalText}
          />
          <Input
            label="Note"
            placeholder="Optional"
            value={note}
            onChangeText={setNote}
          />
          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
