/**
 * app/(app)/income.tsx
 *
 * Monthly salary and fixed bills. Described once; the database posts them as
 * real transactions on their day of the month so the ledger stays honest.
 */

import { CategoryBadge, CategoryGlyph } from "@/components/finance/category-icon";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Card, IconTile, Section } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorNote,
  Header,
  LoadingState,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { categoriesFor, defaultCategoryFor, getCategory } from "@/lib/categories";
import { currencySymbol, formatMoney, parseAmount, toAmountInput } from "@/lib/currency";
import { shortDayLabel } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import {
  useAccounts,
  useCurrency,
  useDeleteRecurring,
  useRecurring,
  useSaveRecurring,
  useSetRecurringActive,
} from "@/lib/queries";
import { useScopeLabel } from "@/lib/scope";
import {
  BriefcaseIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  WalletIcon,
} from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";
import type { RecurringKind } from "@/types/database";
import type { RecurringView } from "@/types/finance";

const KIND_OPTIONS: { value: RecurringKind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Bill" },
];

export default function Income() {
  const currency = useCurrency();
  const ledger = useScopeLabel();
  const { accounts } = useAccounts();
  const { entries, isLoading, error, refetch } = useRecurring();
  const save = useSaveRecurring();
  const setActive = useSetRecurringActive();
  const remove = useDeleteRecurring();

  const [editing, setEditing] = useState<RecurringView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kind, setKind] = useState<RecurringKind>("income");
  const [label, setLabel] = useState("");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryFor("income"));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState("25");
  const [picker, setPicker] = useState<"none" | "category" | "account">("none");
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useMemo(() => categoriesFor(kind), [kind]);
  const income = entries.filter((entry) => entry.kind === "income");
  const bills = entries.filter((entry) => entry.kind === "expense");
  const monthlyIn = income
    .filter((entry) => entry.active)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthlyOut = bills
    .filter((entry) => entry.active)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const openNew = (nextKind: RecurringKind = "income") => {
    setEditing(null);
    setKind(nextKind);
    setLabel(nextKind === "income" ? "Salary" : "");
    setAmountText("");
    setCategoryId(defaultCategoryFor(nextKind));
    setAccountId(accounts[0]?.id ?? null);
    setDayOfMonth(nextKind === "income" ? "25" : "1");
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (entry: RecurringView) => {
    setEditing(entry);
    setKind(entry.kind);
    setLabel(entry.label);
    setAmountText(toAmountInput(entry.amount, currency));
    setCategoryId(entry.category_id);
    setAccountId(entry.account_id);
    setDayOfMonth(String(entry.day_of_month));
    setFormError(null);
    setSheetOpen(true);
  };

  const changeKind = (next: RecurringKind) => {
    setKind(next);
    if (getCategory(categoryId).applies !== next) {
      setCategoryId(defaultCategoryFor(next));
    }
  };

  const submit = async () => {
    if (label.trim().length < 2) {
      setFormError("Give it a name.");
      return;
    }
    const amount = parseAmount(amountText, currency);
    if (amount === null || amount <= 0) {
      setFormError("Enter an amount.");
      return;
    }
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setFormError("Day of month must be between 1 and 31.");
      return;
    }

    try {
      await save.mutateAsync({
        id: editing?.id,
        draft: {
          kind,
          label,
          amount,
          categoryId,
          accountId,
          dayOfMonth: day,
        },
      });
      setSheetOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't save"));
    }
  };

  const confirmDelete = (entry: RecurringView) => {
    Alert.alert(`Remove ${entry.label}?`, "Past posted transactions stay in the ledger.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void remove.mutateAsync(entry.id).catch(() => {}),
      },
    ]);
  };

  const renderList = (list: RecurringView[], empty: string) => (
    <Card flush>
      {list.length === 0 ? (
        <AppText className="px-5 py-6 text-center text-sm text-muted">{empty}</AppText>
      ) : (
        list.map((entry, index) => (
          <Pressable
            key={entry.id}
            onPress={() => openEdit(entry)}
            className={`px-5 py-4 active:bg-subtle ${
              index === list.length - 1 ? "" : "border-b border-hairline"
            } ${entry.active ? "" : "opacity-50"}`}
          >
            <View className="flex-row items-center gap-3">
              <CategoryBadge categoryId={entry.category_id} size={34} />
              <View className="flex-1">
                <AppText className="text-base font-semibold text-ink">{entry.label}</AppText>
                <AppText className="mt-0.5 text-sm text-muted">
                  Day {entry.day_of_month}
                  {entry.accountName ? ` · ${entry.accountName}` : ""}
                  {entry.postedThisMonth
                    ? " · posted this month"
                    : ` · next ${shortDayLabel(entry.nextPostOn)}`}
                </AppText>
              </View>
              <Money
                amount={entry.amount}
                currency={currency}
                kind={entry.kind}
              />
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() =>
                  void setActive.mutateAsync({ id: entry.id, active: !entry.active })
                }
                className="flex-row items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5"
              >
                {entry.active ? (
                  <PauseIcon size={14} color="#1e3a5f" weight="bold" />
                ) : (
                  <PlayIcon size={14} color="#1e3a5f" weight="bold" />
                )}
                <AppText className="text-xs font-semibold text-brand">
                  {entry.active ? "Pause" : "Resume"}
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(entry)}
                className="flex-row items-center gap-1.5 rounded-full bg-negative-soft px-3 py-1.5"
              >
                <TrashIcon size={14} color="#e02020" weight="bold" />
                <AppText className="text-xs font-semibold text-negative">Remove</AppText>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}
    </Card>
  );

  return (
    <Screen>
      <Header
        title="Salary & bills"
        subtitle={ledger}
        back
        right={
          <Pressable
            onPress={() => openNew("income")}
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

          {entries.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BriefcaseIcon size={28} color="#1e3a5f" weight="duotone" />}
                title="No monthly income yet"
                message="Add your salary once. Duo Wallet posts it on payday so the month stays accurate."
                action={
                  <View className="gap-2">
                    <Button
                      onPress={() => openNew("income")}
                      icon={<PlusIcon size={20} color="#fff" weight="bold" />}
                    >
                      Add salary
                    </Button>
                    <Button variant="secondary" onPress={() => openNew("expense")}>
                      Add a fixed bill
                    </Button>
                  </View>
                }
              />
            </Card>
          ) : (
            <>
              <View className="flex-row gap-3">
                <Card className="flex-1">
                  <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                    Monthly in
                  </AppText>
                  <Money
                    amount={monthlyIn}
                    currency={currency}
                    size="lg"
                    className="mt-1 text-positive"
                  />
                </Card>
                <Card className="flex-1">
                  <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                    Fixed bills
                  </AppText>
                  <Money
                    amount={monthlyOut}
                    currency={currency}
                    size="lg"
                    className="mt-1 text-ink"
                  />
                </Card>
              </View>

              <Section
                title="Income"
                action={
                  <Pressable hitSlop={8} onPress={() => openNew("income")}>
                    <AppText className="text-sm font-semibold text-brand">Add</AppText>
                  </Pressable>
                }
              >
                {renderList(income, "No salary or recurring income yet.")}
              </Section>

              <Section
                title="Fixed bills"
                action={
                  <Pressable hitSlop={8} onPress={() => openNew("expense")}>
                    <AppText className="text-sm font-semibold text-brand">Add</AppText>
                  </Pressable>
                }
              >
                {renderList(bills, "No fixed bills yet.")}
              </Section>
            </>
          )}
        </ScreenScroll>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit monthly entry" : "New monthly entry"}
        footer={
          <Button size="lg" loading={save.isPending} onPress={submit}>
            {editing ? "Save" : "Add"}
          </Button>
        }
      >
        <View className="gap-4 px-1 pb-2">
          <Segmented options={KIND_OPTIONS} value={kind} onChange={changeKind} />
          <Input
            label="Label"
            placeholder={kind === "income" ? "Salary, side hustle…" : "Rent, Wi‑Fi…"}
            value={label}
            onChangeText={setLabel}
          />
          <Input
            label={`Amount (${currencySymbol(currency)})`}
            placeholder="0"
            keyboardType="decimal-pad"
            value={amountText}
            onChangeText={setAmountText}
          />
          <Input
            label="Day of month"
            placeholder="25"
            keyboardType="number-pad"
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
          />
          <Pressable
            onPress={() => setPicker("category")}
            className="flex-row items-center gap-3 rounded-2xl border border-hairline bg-subtle px-4 py-3"
          >
            <CategoryBadge categoryId={categoryId} size={34} />
            <View className="flex-1">
              <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                Category
              </AppText>
              <AppText className="text-base font-semibold text-ink">
                {getCategory(categoryId).label}
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setPicker("account")}
            className="flex-row items-center gap-3 rounded-2xl border border-hairline bg-subtle px-4 py-3"
          >
            <IconTile color="#2a5298">
              <WalletIcon size={20} color="#2a5298" weight="duotone" />
            </IconTile>
            <View className="flex-1">
              <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                Account
              </AppText>
              <AppText className="text-base font-semibold text-ink">
                {accounts.find((account) => account.id === accountId)?.name ?? "Optional"}
              </AppText>
            </View>
          </Pressable>
          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

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

      <Sheet visible={picker === "account"} onClose={() => setPicker("none")} title="Account">
        <SheetOption
          label="No account"
          selected={accountId === null}
          onPress={() => {
            setAccountId(null);
            setPicker("none");
          }}
        />
        {accounts.map((account) => (
          <SheetOption
            key={account.id}
            label={account.name}
            description={formatMoney(account.balance, currency)}
            selected={account.id === accountId}
            leading={
              <IconTile color={account.color}>
                <WalletIcon size={20} color={account.color} weight="duotone" />
              </IconTile>
            }
            onPress={() => {
              setAccountId(account.id);
              setPicker("none");
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
