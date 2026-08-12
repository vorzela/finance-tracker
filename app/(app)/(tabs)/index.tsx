/**
 * app/(app)/(tabs)/index.tsx
 *
 * The dashboard. Answers, in order: what have we spent this month, are we on
 * track, who spent it, where did it go, and what happened most recently.
 *
 * Every number comes from `lib/analytics.ts`; this screen only arranges them.
 */

import { Donut, DonutLegend, SpendLine } from "@/components/finance/charts";
import { LedgerSwitcher } from "@/components/finance/ledger-switcher";
import { Money } from "@/components/finance/money";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { TransactionRow } from "@/components/finance/transaction-row";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { ProgressBar, StackedBar } from "@/components/ui/progress";
import { EmptyState, ErrorNote, LoadingState, Screen, ScreenScroll } from "@/components/ui/screen";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { formatMoney, formatPercent } from "@/lib/currency";
import { monthProgress } from "@/lib/date";
import { useMonth } from "@/lib/month";
import {
  useAccounts,
  useCoupleBalance,
  useCurrency,
  useMonthOverview,
  useProfile,
  useTransactionViews,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  PlusIcon,
  TargetIcon,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "phosphor-react-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function Home() {
  const { monthKey, setMonthKey } = useMonth();
  const { scope } = useScope();
  const currency = useCurrency();
  const router = useRouter();

  const { data: profile } = useProfile();
  const { overview, rows, isLoading, isRefetching, error, refetch } =
    useMonthOverview(monthKey);
  const views = useTransactionViews(rows.slice(0, 5));
  const { accounts } = useAccounts();
  const couple = useCoupleBalance();

  const isShared = scope.kind === "group";
  const firstName = (profile?.display_name ?? "there").split(" ")[0];

  if (isLoading && !overview) {
    return (
      <Screen>
        <LoadingState label="Loading your ledger" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScroll
        onRefresh={refetch}
        refreshing={isRefetching}
        bottomInset={TAB_BAR_HEIGHT + 24}
        contentContainerStyle={{ paddingTop: 8 }}
      >
        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1.5">
            <Text className="text-sm text-gray-500">{greeting()}, {firstName}</Text>
            <LedgerSwitcher />
          </View>

          <Link href="/profile" asChild>
            <Pressable hitSlop={8}>
              <Avatar
                name={profile?.display_name ?? "Me"}
                color={profile?.color}
                size="lg"
              />
            </Pressable>
          </Link>
        </View>

        {error ? <ErrorNote message={error.message} onRetry={refetch} /> : null}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View className="overflow-hidden rounded-[28px]">
          <LinearGradient
            colors={["#2f5ba8", "#1b3560", "#0d1c33"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View className="flex-row items-start justify-between">
              <Text className="text-sm font-medium text-white/70">
                {isShared ? "Household spending" : "You've spent"}
              </Text>
              <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} inverted />
            </View>

            <View className="mt-3 flex-row items-end justify-between">
              <Text className="text-[42px] font-bold leading-tight tracking-tighter tabular-nums text-white">
                {formatMoney(overview?.totals.spent ?? 0, currency)}
              </Text>
            </View>

            <ChangeChip
              changeRatio={overview?.changeRatio ?? null}
              previous={overview?.previousSpent ?? 0}
              currency={currency}
            />

            <View className="mt-5 flex-row gap-3">
              <HeroStat
                label="Money in"
                amount={overview?.totals.earned ?? 0}
                currency={currency}
                icon={<ArrowDownRightIcon size={13} color="#6ec99a" weight="bold" />}
              />
              <HeroStat
                label={(overview?.totals.net ?? 0) >= 0 ? "Left over" : "Overspent"}
                amount={Math.abs(overview?.totals.net ?? 0)}
                currency={currency}
                icon={
                  (overview?.totals.net ?? 0) >= 0 ? (
                    <TrendUpIcon size={13} color="#6ec99a" weight="bold" />
                  ) : (
                    <TrendDownIcon size={13} color="#ff8585" weight="bold" />
                  )
                }
              />
            </View>
          </LinearGradient>
        </View>

        {/* ── Couple / household balances ─────────────────────────────── */}
        {isShared && couple.data && couple.data.perMember.length > 0 ? (
          <Section title="Together">
            <Card>
              <View className="flex-row items-end justify-between">
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-faint">
                    Combined balance
                  </Text>
                  <Money
                    amount={couple.data.total}
                    currency={currency}
                    size="xl"
                    className="mt-1"
                  />
                  <Text className="mt-1 text-sm text-muted">
                    Opening{" "}
                    {formatMoney(couple.data.openingTotal, currency)}
                    {" · "}
                    both of you
                  </Text>
                </View>
              </View>

              <View className="mt-5 gap-3 border-t border-hairline pt-4">
                {couple.data.perMember.map((entry) => (
                  <View key={entry.member.id} className="flex-row items-center gap-3">
                    <Avatar
                      name={entry.member.name}
                      color={entry.member.color}
                      size="sm"
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink">
                        {entry.member.isSelf ? "You" : entry.member.name}
                      </Text>
                      <Text className="text-xs text-muted">
                        Opened with {formatMoney(entry.openingBalance, currency)}
                      </Text>
                    </View>
                    <Money amount={entry.balance} currency={currency} />
                  </View>
                ))}
              </View>
            </Card>
          </Section>
        ) : null}

        {/* ── Nothing logged yet ───────────────────────────────────────── */}
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<WalletIcon size={28} color="#1e3a5f" weight="duotone" />}
              title="No spending logged"
              message={
                isShared
                  ? "Add the first shared expense and it will show up on both your phones."
                  : "Add your first expense and this screen fills in around it."
              }
              action={
                <Button
                  size="lg"
                  onPress={() => router.push("/entry")}
                  icon={<PlusIcon size={20} color="#fff" weight="bold" />}
                >
                  Add a transaction
                </Button>
              }
            />
          </Card>
        ) : null}

        {/* ── Pace ─────────────────────────────────────────────────────── */}
        {rows.length > 0 ? (
          <PaceCard
            monthKey={monthKey}
            spent={overview?.totals.spent ?? 0}
            projected={overview?.projectedSpend ?? 0}
            currency={currency}
            budgetLimit={overview?.topBudget?.limit ?? null}
            days={overview?.days ?? []}
          />
        ) : null}

        {/* ── Budget ───────────────────────────────────────────────────── */}
        {overview?.topBudget ? (
          <Section
            title="Budget"
            action={
              <Link href="/budgets" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-sm font-semibold text-navy-500">Manage</Text>
                </Pressable>
              </Link>
            }
          >
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-tight text-gray-900">
                  {overview.topBudget.label}
                </Text>
                <Text
                  className={`text-sm font-bold ${
                    overview.topBudget.health === "over"
                      ? "text-red-500"
                      : overview.topBudget.health === "caution"
                        ? "text-gold-500"
                        : "text-green-500"
                  }`}
                >
                  {formatPercent(overview.topBudget.ratio)}
                </Text>
              </View>

              <ProgressBar
                ratio={overview.topBudget.ratio}
                color={
                  overview.topBudget.health === "over"
                    ? "#e02020"
                    : overview.topBudget.health === "caution"
                      ? "#f59e0b"
                      : "#1f9155"
                }
                className="mt-3"
                height={10}
              />

              <View className="mt-3 flex-row justify-between">
                <Text className="text-sm text-gray-500">
                  {formatMoney(overview.topBudget.spent, currency)} of{" "}
                  {formatMoney(overview.topBudget.limit, currency)}
                </Text>
                <Text
                  className={`text-sm font-semibold ${
                    overview.topBudget.remaining < 0 ? "text-red-500" : "text-gray-700"
                  }`}
                >
                  {overview.topBudget.remaining < 0
                    ? `${formatMoney(-overview.topBudget.remaining, currency)} over`
                    : `${formatMoney(overview.topBudget.remaining, currency)} left`}
                </Text>
              </View>
            </Card>
          </Section>
        ) : rows.length > 0 ? (
          <Link href="/budgets" asChild>
            <Pressable>
              <Card className="flex-row items-center gap-4">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-gold-50">
                  <TargetIcon size={22} color="#b45309" weight="duotone" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold tracking-tight text-gray-900">
                    Set a monthly budget
                  </Text>
                  <Text className="mt-0.5 text-sm text-gray-500">
                    Get a nudge before the money runs out, not after.
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Link>
        ) : null}

        {/* ── Who spent it ─────────────────────────────────────────────── */}
        {isShared && (overview?.totals.spent ?? 0) > 0 ? (
          <Section
            title="Who spent it"
            action={
              <Link href="/household" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-sm font-semibold text-navy-500">Household</Text>
                </Pressable>
              </Link>
            }
          >
            <Card>
              <StackedBar
                segments={(overview?.members ?? []).map((entry) => ({
                  key: entry.member.id,
                  share: entry.share,
                  color: entry.member.color,
                }))}
                height={12}
              />

              <View className="mt-4 gap-3">
                {(overview?.members ?? []).map((entry) => (
                  <View key={entry.member.id} className="flex-row items-center gap-3">
                    <Avatar
                      name={entry.member.name}
                      color={entry.member.color}
                      size="sm"
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">
                        {entry.member.isSelf ? "You" : entry.member.name}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {entry.count} {entry.count === 1 ? "entry" : "entries"}
                        {entry.earned > 0
                          ? ` · ${formatMoney(entry.earned, currency, { compact: true })} in`
                          : ""}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Money amount={entry.spent} currency={currency} />
                      <Text className="text-xs text-gray-400">
                        {Math.round(entry.share * 100)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </Section>
        ) : null}

        {/* ── Where it went ────────────────────────────────────────────── */}
        {(overview?.categories.length ?? 0) > 0 ? (
          <Section
            title="Where it went"
            action={
              <Link href="/(app)/(tabs)/insights" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-sm font-semibold text-navy-500">Insights</Text>
                </Pressable>
              </Link>
            }
          >
            <Card>
              <View className="flex-row items-center gap-5">
                <Donut
                  slices={(overview?.categories ?? []).slice(0, 6).map((category) => ({
                    key: category.categoryId,
                    value: category.total,
                    color: category.color,
                  }))}
                  size={132}
                  thickness={18}
                >
                  <View className="items-center">
                    <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Top
                    </Text>
                    <Text
                      className="max-w-[76px] text-center text-xs font-bold text-gray-900"
                      numberOfLines={2}
                    >
                      {overview?.categories[0]?.label}
                    </Text>
                  </View>
                </Donut>

                <DonutLegend
                  categories={overview?.categories ?? []}
                  currency={currency}
                  max={5}
                />
              </View>
            </Card>
          </Section>
        ) : null}

        {/* ── Accounts ─────────────────────────────────────────────────── */}
        {accounts.length > 0 ? (
          <Section
            title="Accounts"
            action={
              <Link href="/accounts" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-sm font-semibold text-navy-500">Manage</Text>
                </Pressable>
              </Link>
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            >
              {accounts.map((account) => (
                <View
                  key={account.id}
                  className="min-w-[148px] rounded-3xl border border-gray-200/70 bg-white p-4"
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${account.color}1a` }}
                  >
                    <WalletIcon size={16} color={account.color} weight="duotone" />
                  </View>
                  <Text
                    className="mt-3 text-sm font-medium text-gray-500"
                    numberOfLines={1}
                  >
                    {account.name}
                  </Text>
                  <Money
                    amount={account.balance}
                    currency={currency}
                    size="lg"
                    className={account.balance < 0 ? "text-red-500" : undefined}
                  />
                </View>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/* ── Recent ───────────────────────────────────────────────────── */}
        {views.length > 0 ? (
          <Section
            title="Recent"
            action={
              <Link href="/(app)/(tabs)/activity" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-sm font-semibold text-navy-500">See all</Text>
                </Pressable>
              </Link>
            }
          >
            <Card flush>
              {views.map((view, index) => (
                <TransactionRow
                  key={view.id}
                  transaction={view}
                  currency={currency}
                  showMember={isShared}
                  last={index === views.length - 1}
                  onPress={() => router.push({ pathname: "/entry", params: { id: view.id } })}
                />
              ))}
            </Card>
          </Section>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HeroStat({
  label,
  amount,
  currency,
  icon,
}: {
  label: string;
  amount: number;
  currency: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-white/10 px-3.5 py-3">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {label}
        </Text>
      </View>
      <Text className="mt-1 text-lg font-bold tracking-tight tabular-nums text-white">
        {formatMoney(amount, currency)}
      </Text>
    </View>
  );
}

function ChangeChip({
  changeRatio,
  previous,
  currency,
}: {
  changeRatio: number | null;
  previous: number;
  currency: string;
}) {
  if (changeRatio === null) {
    return (
      <Text className="mt-1 text-sm text-white/50">
        {previous === 0 ? "First month on the books" : ""}
      </Text>
    );
  }

  const up = changeRatio > 0;

  return (
    <View className="mt-1.5 flex-row items-center gap-1.5">
      {up ? (
        <ArrowUpRightIcon size={13} color="#ff8585" weight="bold" />
      ) : (
        <ArrowDownRightIcon size={13} color="#6ec99a" weight="bold" />
      )}
      <Text className="text-sm text-white/70">
        <Text className={up ? "font-bold text-red-200" : "font-bold text-green-200"}>
          {formatPercent(Math.abs(changeRatio))}
        </Text>{" "}
        {up ? "more" : "less"} than last month
      </Text>
    </View>
  );
}

/** Cumulative spend against the month's elapsed share. */
function PaceCard({
  monthKey,
  spent,
  projected,
  currency,
  budgetLimit,
  days,
}: {
  monthKey: string;
  spent: number;
  projected: number;
  currency: string;
  budgetLimit: number | null;
  days: { dayKey: string; spent: number; cumulative: number }[];
}) {
  const { dayOfMonth, totalDays, daysRemaining } = monthProgress(monthKey);
  const perDay = dayOfMonth > 0 ? Math.round(spent / dayOfMonth) : 0;

  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Pace
          </Text>
          <Text className="mt-1.5 text-base text-gray-700">
            <Text className="font-bold text-gray-900">
              {formatMoney(perDay, currency, { compact: true })}
            </Text>{" "}
            a day
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
            On track for
          </Text>
          <Text className="mt-1.5 text-base font-bold tracking-tight text-gray-900">
            {formatMoney(projected, currency, { compact: true })}
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <SpendLine days={days} target={budgetLimit ?? undefined} height={80} />
      </View>

      <Text className="mt-2 text-xs text-gray-400">
        Day {dayOfMonth} of {totalDays}
        {daysRemaining > 0 ? ` · ${daysRemaining} days left` : " · month complete"}
        {budgetLimit ? ` · amber line is your ${formatMoney(budgetLimit, currency, { compact: true })} budget` : ""}
      </Text>
    </Card>
  );
}
