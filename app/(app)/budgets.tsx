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
import { FormSheet } from "@/components/ui/form-sheet";
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
import { useThemeColors } from "@/lib/theme";
import { PlusIcon, TargetIcon, TrashIcon } from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";
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
  const colors = useThemeColors();

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
                      <AppText className="text-[11px] font-semibold tracking-wide text-muted">
                        Budgeted this month
                      </AppText>
                      <Money
                        amount={totalSpent}
                        currency={currency}
                        size="xl"
                        className="mt-1"
                      />
                    </View>
                    <AppText className="text-[14px] text-muted">
                      of {formatMoney(totalLimit, currency)}
                    </AppText>
                  </View>
                  <ProgressBar
                    ratio={totalLimit === 0 ? 0 : totalSpent / totalLimit}
                    color={totalSpent > totalLimit ? colors.negative : colors.brand}
                    className="mt-3"
                    height={10}
                  />
                  {daysRemaining > 0 ? (
                    <AppText className="mt-2 text-[12px] text-faint">
                      {daysRemaining} days left in {monthLabel(monthKey)}
                    </AppText>
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
                            <IconTile color={colors.brand}>
                              <TargetIcon size={20} color={colors.brand} weight="duotone" />
                            </IconTile>
                          )}

                          <View className="flex-1">
                            <AppText className="text-[16px] font-semibold tracking-tight text-ink">
                              {status.label}
                            </AppText>
                            <AppText className="mt-0.5 text-[13px] text-muted">
                              {formatMoney(status.spent, currency)} of{" "}
                              {formatMoney(status.limit, currency)}
                            </AppText>
                          </View>

                          <AppText
                            className="text-sm font-bold tabular-nums"
                            style={{ color: HEALTH_COLORS[status.health] }}
                          >
                            {formatPercent(status.ratio)}
                          </AppText>
                        </View>

                        <ProgressBar
                          ratio={status.ratio}
                          color={HEALTH_COLORS[status.health]}
                          className="mt-3"
                          height={8}
                        />

                        <AppText
                          className={cn(
                            "mt-2 text-[12px]",
                            status.health === "over" ? "text-negative" : "text-faint",
                          )}
                        >
                          {status.remaining < 0
                            ? `${formatMoney(-status.remaining, currency)} over budget`
                            : daysRemaining > 0
                              ? `${formatMoney(status.remaining, currency)} left · ${formatMoney(status.dailyAllowance, currency, { compact: true })} a day`
                              : `${formatMoney(status.remaining, currency)} unspent`}
                        </AppText>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </Section>
            </>
          )}
        </ScreenScroll>
      )}

      <FormSheet
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
              "will-change-pressable flex-row items-center gap-3 rounded-2xl px-4 py-3",
              !editing && "active:opacity-80",
            )}
            style={{ backgroundColor: colors.subtle }}
          >
            {categoryId ? (
              <CategoryBadge categoryId={categoryId} size={40} />
            ) : (
              <IconTile color={colors.brand}>
                <TargetIcon size={20} color={colors.brand} weight="duotone" />
              </IconTile>
            )}
            <View className="flex-1">
              <AppText className="text-[11px] font-semibold tracking-wide" style={{ color: colors.muted }}>
                Applies to
              </AppText>
              <AppText className="mt-0.5 text-[16px] font-semibold" style={{ color: colors.ink }}>
                {categoryId ? categoryName(categoryId) : "Everything"}
              </AppText>
            </View>
            {!editing ? (
              <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
                Change
              </AppText>
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
              <AppText className="text-base font-bold" style={{ color: colors.faint }}>
                {currencySymbol(currency)}
              </AppText>
            }
          />

          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </FormSheet>

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
            <IconTile color={colors.brand}>
              <TargetIcon size={20} color={colors.brand} weight="duotone" />
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
