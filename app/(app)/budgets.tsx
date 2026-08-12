/**
 * app/(app)/budgets.tsx
 *
 * Monthly ceilings for the active ledger, with this month's spend measured
 * against each one. A budget with no category is the "everything" ceiling.
 */

import { CategoryBadge, CategoryGlyph } from "@/components/finance/category-icon";
import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { Card, IconTile, Section } from "@/components/ui/card";
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
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { budgetStatuses } from "@/lib/analytics";
import { BUDGETABLE_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { currencySymbol, formatMoney, formatPercent, parseAmount, toAmountInput } from "@/lib/currency";
import { monthLabel, monthProgress } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import { useMonth } from "@/lib/month";
import {
  useBudgets,
  useCurrency,
  useDeleteBudget,
  useSaveBudget,
  useTransactions,
} from "@/lib/queries";
import { useScopeLabel } from "@/lib/scope";
import { PlusIcon, TargetIcon, TrashIcon } from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { BudgetStatus } from "@/types/finance";

const HEALTH_COLORS = {
  ok: "#1f9155",
  caution: "#f59e0b",
  over: "#e02020",
} as const;

export default function Budgets() {
  const { monthKey } = useMonth();
  const currency = useCurrency();
  const ledger = useScopeLabel();

  const budgets = useBudgets();
  const transactions = useTransactions(monthKey);
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetStatus | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limitText, setLimitText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const statuses = useMemo(
    () => budgetStatuses(budgets.data ?? [], transactions.data ?? [], monthKey),
    [budgets.data, transactions.data, monthKey],
  );

  const totalLimit = statuses
    .filter((status) => status.categoryId !== null)
    .reduce((sum, status) => sum + status.limit, 0);
  const totalSpent = statuses
    .filter((status) => status.categoryId !== null)
    .reduce((sum, status) => sum + status.spent, 0);

  const used = new Set(statuses.map((status) => status.categoryId));
  const available = BUDGETABLE_CATEGORIES.filter((category) => !used.has(category.id));

  const openNew = () => {
    setEditing(null);
    setCategoryId(available[0]?.id ?? null);
    setLimitText("");
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (status: BudgetStatus) => {
    setEditing(status);
    setCategoryId(status.categoryId);
    setLimitText(toAmountInput(status.limit, currency));
    setFormError(null);
    setSheetOpen(true);
  };

  const submit = async () => {
    const limitAmount = parseAmount(limitText, currency);
    if (limitAmount === null) {
      setFormError("Enter a monthly limit.");
      return;
    }

    try {
      await saveBudget.mutateAsync({
        existing: editing?.budget ?? null,
        draft: { categoryId, limitAmount },
      });
      setSheetOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't save the budget"));
    }
  };

  const confirmDelete = (status: BudgetStatus) => {
    Alert.alert(`Remove the ${status.label} budget?`, "Spending is still tracked.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBudget.mutateAsync(status.budget.id);
            setSheetOpen(false);
          } catch (cause) {
            Alert.alert("Couldn't remove", getErrorMessage(cause));
          }
        },
      },
    ]);
  };

  const { daysRemaining } = monthProgress(monthKey);

  return (
    <Screen>
      <Header
        title="Budgets"
        subtitle={`${ledger} · ${monthLabel(monthKey)}`}
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

      {budgets.isLoading ? (
        <LoadingState />
      ) : (
        <ScreenScroll onRefresh={() => void budgets.refetch()}>
          {budgets.error ? (
            <ErrorNote
              message={(budgets.error as Error).message}
              onRetry={() => void budgets.refetch()}
            />
          ) : null}

          {statuses.length === 0 ? (
            <Card>
              <EmptyState
                icon={<TargetIcon size={28} color="#1e3a5f" weight="duotone" />}
                title="No budgets set"
                message="Pick the categories that tend to run away — groceries and eating out are the usual suspects."
                action={
                  <Button onPress={openNew} icon={<PlusIcon size={20} color="#fff" weight="bold" />}>
                    Set a budget
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              {totalLimit > 0 ? (
                <Card>
                  <View className="flex-row items-end justify-between">
                    <View>
                      <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Budgeted this month
                      </Text>
                      <Money
                        amount={totalSpent}
                        currency={currency}
                        size="xl"
                        className="mt-1"
                      />
                    </View>
                    <Text className="text-sm text-gray-500">
                      of {formatMoney(totalLimit, currency)}
                    </Text>
                  </View>
                  <ProgressBar
                    ratio={totalLimit === 0 ? 0 : totalSpent / totalLimit}
                    color={totalSpent > totalLimit ? "#e02020" : "#1e3a5f"}
                    className="mt-3"
                    height={10}
                  />
                  {daysRemaining > 0 ? (
                    <Text className="mt-2 text-xs text-gray-400">
                      {daysRemaining} days left in {monthLabel(monthKey)}
                    </Text>
                  ) : null}
                </Card>
              ) : null}

              <Section title="Per category">
                <View className="gap-3">
                  {statuses.map((status) => (
                    <Pressable key={status.budget.id} onPress={() => openEdit(status)}>
                      <Card>
                        <View className="flex-row items-center gap-3">
                          {status.categoryId ? (
                            <CategoryBadge categoryId={status.categoryId} size={40} />
                          ) : (
                            <IconTile color="#1e3a5f">
                              <TargetIcon size={20} color="#1e3a5f" weight="duotone" />
                            </IconTile>
                          )}

                          <View className="flex-1">
                            <Text className="text-base font-bold tracking-tight text-gray-900">
                              {status.label}
                            </Text>
                            <Text className="mt-0.5 text-sm text-gray-500">
                              {formatMoney(status.spent, currency)} of{" "}
                              {formatMoney(status.limit, currency)}
                            </Text>
                          </View>

                          <Text
                            className="text-sm font-bold tabular-nums"
                            style={{ color: HEALTH_COLORS[status.health] }}
                          >
                            {formatPercent(status.ratio)}
                          </Text>
                        </View>

                        <ProgressBar
                          ratio={status.ratio}
                          color={HEALTH_COLORS[status.health]}
                          className="mt-3"
                          height={8}
                        />

                        <Text
                          className={cn(
                            "mt-2 text-xs",
                            status.health === "over" ? "text-red-500" : "text-gray-400",
                          )}
                        >
                          {status.remaining < 0
                            ? `${formatMoney(-status.remaining, currency)} over budget`
                            : daysRemaining > 0
                              ? `${formatMoney(status.remaining, currency)} left · ${formatMoney(status.dailyAllowance, currency, { compact: true })} a day`
                              : `${formatMoney(status.remaining, currency)} unspent`}
                        </Text>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </Section>
            </>
          )}
        </ScreenScroll>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit budget" : "New budget"}
        footer={
          <View className="gap-2">
            <Button size="lg" loading={saveBudget.isPending} onPress={submit}>
              {editing ? "Save budget" : "Set budget"}
            </Button>
            {editing ? (
              <Button
                variant="danger"
                outline
                icon={<TrashIcon size={18} color="#e02020" />}
                onPress={() => confirmDelete(editing)}
              >
                Remove budget
              </Button>
            ) : null}
          </View>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Pressable
            onPress={() => !editing && setCategoryOpen(true)}
            className={cn(
              "flex-row items-center gap-3 rounded-2xl border border-gray-200/60 bg-gray-50 px-4 py-3",
              !editing && "active:bg-gray-100",
            )}
          >
            {categoryId ? (
              <CategoryBadge categoryId={categoryId} size={40} />
            ) : (
              <IconTile color="#1e3a5f">
                <TargetIcon size={20} color="#1e3a5f" weight="duotone" />
              </IconTile>
            )}
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Applies to
              </Text>
              <Text className="mt-0.5 text-base font-semibold text-gray-900">
                {categoryId ? categoryName(categoryId) : "Everything"}
              </Text>
            </View>
            {!editing ? (
              <Text className="text-sm font-semibold text-navy-500">Change</Text>
            ) : null}
          </Pressable>

          <Input
            label="Monthly limit"
            placeholder="0"
            value={limitText}
            onChangeText={setLimitText}
            keyboardType="decimal-pad"
            autoFocus={!editing}
            leadingNode={
              <Text className="text-base font-bold text-gray-400">
                {currencySymbol(currency)}
              </Text>
            }
          />

          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </Sheet>

      <Sheet
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Budget what?"
      >
        <SheetOption
          label="Everything"
          description="One ceiling for all spending"
          selected={categoryId === null}
          leading={
            <IconTile color="#1e3a5f">
              <TargetIcon size={20} color="#1e3a5f" weight="duotone" />
            </IconTile>
          }
          onPress={() => {
            setCategoryId(null);
            setCategoryOpen(false);
          }}
        />
        {available.map((category) => (
          <SheetOption
            key={category.id}
            label={category.label}
            selected={categoryId === category.id}
            leading={
              <IconTile color={category.color}>
                <CategoryGlyph categoryId={category.id} size={20} />
              </IconTile>
            }
            onPress={() => {
              setCategoryId(category.id);
              setCategoryOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function categoryName(categoryId: string): string {
  return BUDGETABLE_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}
