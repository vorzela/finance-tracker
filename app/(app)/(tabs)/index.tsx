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
import { EmptyState, ErrorNote, Screen, ScreenScroll } from "@/components/ui/screen";
import { DashboardSkeleton } from "@/components/ui/shimmer";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { formatMoney, formatPercent } from "@/lib/currency";
import { monthProgress } from "@/lib/date";
import { useMonth } from "@/lib/month";
import {
  useCurrency,
  useMonthOverview,
  useProfile,
  useTransactionViews,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
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
import { AppText } from "@/components/ui/app-text";
import { Pressable, ScrollView, View } from "react-native";

export default function Home() {
  const { monthKey, setMonthKey } = useMonth();
  const { scope } = useScope();
  const currency = useCurrency();
  const router = useRouter();

  const { data: profile } = useProfile();
  const { overview, rows, accounts, couple, isLoading, isRefetching, error, refetch } =
    useMonthOverview(monthKey);
  const views = useTransactionViews(rows.slice(0, 5));
  const colors = useThemeColors();

  const isShared = scope.kind === "group";
  const firstName = (profile?.display_name ?? "there").split(" ")[0];

  if (isLoading && !overview) {
    return (
      <Screen>
        <ScreenScroll bottomInset={TAB_BAR_HEIGHT + 24} contentContainerStyle={{ paddingTop: 8 }}>
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1 gap-2">
              <AppText className="text-[13px] font-medium text-muted">
                {greeting()}, {firstName}
              </AppText>
              <AppText className="text-[28px] font-bold leading-8 tracking-tight text-ink">
                Overview
              </AppText>
              <LedgerSwitcher />
            </View>
            <Link href="/profile" asChild>
              <Pressable hitSlop={8} className="active:opacity-80">
                <Avatar
                  name={profile?.display_name ?? "Me"}
                  color={profile?.color}
                  uri={profile?.avatar_url}
                  size="lg"
                />
              </Pressable>
            </Link>
          </View>
          <DashboardSkeleton />
        </ScreenScroll>
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
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 gap-2">
            <AppText className="text-[13px] font-medium text-muted">
              {greeting()}, {firstName}
            </AppText>
            <AppText className="text-[28px] font-bold leading-8 tracking-tight text-ink">
              Overview
            </AppText>
            <LedgerSwitcher />
          </View>

          <Link href="/profile" asChild>
            <Pressable hitSlop={8} className="active:opacity-80">
              <Avatar
                name={profile?.display_name ?? "Me"}
                color={profile?.color}
                uri={profile?.avatar_url}
                size="lg"
              />
            </Pressable>
          </Link>
        </View>

        {error ? <ErrorNote message={error.message} onRetry={refetch} /> : null}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View
          className="overflow-hidden rounded-[26px]"
          style={{
            shadowColor: colors.chrome,
            shadowOpacity: colors.heroInverted ? 0.35 : 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 22 }}
          >
            <View className="flex-row items-start justify-between">
              <AppText
                className="text-sm font-medium"
                style={{ color: colors.onGradientMuted }}
              >
                {isShared ? "Household spending" : "You've spent"}
              </AppText>
              <MonthSwitcher
                monthKey={monthKey}
                onChange={setMonthKey}
                inverted={colors.heroInverted}
              />
            </View>

            <View className="mt-3 flex-row items-end justify-between">
              <AppText
                className="text-[44px] font-bold leading-none tracking-tighter tabular-nums"
                style={{ color: colors.onGradient }}
              >
                {formatMoney(overview?.totals.spent ?? 0, currency)}
              </AppText>
            </View>

            <ChangeChip
              changeRatio={overview?.changeRatio ?? null}
              previous={overview?.previousSpent ?? 0}
              currency={currency}
              ink={colors.onGradient}
              muted={colors.onGradientMuted}
              inverted={colors.heroInverted}
            />

            <View className="mt-5 flex-row gap-3">
              <HeroStat
                label="Money in"
                amount={overview?.totals.earned ?? 0}
                currency={currency}
                ink={colors.onGradient}
                muted={colors.onGradientMuted}
                inverted={colors.heroInverted}
                icon={
                  <ArrowDownRightIcon
                    size={13}
                    color={colors.heroInverted ? "#6ec99a" : colors.positive}
                    weight="bold"
                  />
                }
              />
              <HeroStat
                label={(overview?.totals.net ?? 0) >= 0 ? "Left over" : "Overspent"}
                amount={Math.abs(overview?.totals.net ?? 0)}
                currency={currency}
                ink={colors.onGradient}
                muted={colors.onGradientMuted}
                inverted={colors.heroInverted}
                icon={
                  (overview?.totals.net ?? 0) >= 0 ? (
                    <TrendUpIcon
                      size={13}
                      color={colors.heroInverted ? "#6ec99a" : colors.positive}
                      weight="bold"
                    />
                  ) : (
                    <TrendDownIcon
                      size={13}
                      color={colors.heroInverted ? "#ff8585" : colors.negative}
                      weight="bold"
                    />
                  )
                }
              />
            </View>
          </LinearGradient>
        </View>

        {/* ── Couple / household balances ─────────────────────────────── */}
        {isShared && couple && couple.perMember.length > 0 ? (
          <Section
            title="Together"
            action={
              couple.perMember.length >= 2 ? (
                <Pressable onPress={() => router.push("/chat" as never)} hitSlop={8}>
                  <AppText className="text-[13px] font-semibold text-brand">Chat</AppText>
                </Pressable>
              ) : null
            }
          >
            <Card>
              <View className="flex-row items-end justify-between">
                <View className="flex-1">
                  <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
                    Combined balance
                  </AppText>
                  <Money
                    amount={couple.total}
                    currency={currency}
                    size="xl"
                    className="mt-1"
                  />
                  <AppText className="mt-1 text-sm text-muted">
                    Opening{" "}
                    {formatMoney(couple.openingTotal, currency)}
                    {" · "}
                    both of you
                  </AppText>
                </View>
              </View>

              <View className="mt-5 gap-3 border-t border-hairline pt-4">
                {couple.perMember.map((entry) => (
                  <View key={entry.member.id} className="flex-row items-center gap-3">
                    <Avatar
                      name={entry.member.name}
                      color={entry.member.color}
                      size="sm"
                    />
                    <View className="flex-1">
                      <AppText className="text-sm font-semibold text-ink">
                        {entry.member.isSelf ? "You" : entry.member.name}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        Opened with {formatMoney(entry.openingBalance, currency)}
                      </AppText>
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
              icon={<WalletIcon size={28} color={colors.brand} weight="duotone" />}
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
                  <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
                    Manage
                  </AppText>
                </Pressable>
              </Link>
            }
          >
            <Card>
              <View className="flex-row items-center justify-between">
                <AppText className="text-base font-bold tracking-tight text-ink">
                  {overview.topBudget.label}
                </AppText>
                <AppText
                  className={`text-sm font-bold ${
                    overview.topBudget.health === "over"
                      ? "text-negative"
                      : overview.topBudget.health === "caution"
                        ? "text-gold-500"
                        : "text-green-500"
                  }`}
                >
                  {formatPercent(overview.topBudget.ratio)}
                </AppText>
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
                <AppText className="text-sm text-muted">
                  {formatMoney(overview.topBudget.spent, currency)} of{" "}
                  {formatMoney(overview.topBudget.limit, currency)}
                </AppText>
                <AppText
                  className={`text-sm font-semibold ${
                    overview.topBudget.remaining < 0 ? "text-negative" : "text-ink"
                  }`}
                >
                  {overview.topBudget.remaining < 0
                    ? `${formatMoney(-overview.topBudget.remaining, currency)} over`
                    : `${formatMoney(overview.topBudget.remaining, currency)} left`}
                </AppText>
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
                  <AppText className="text-base font-bold tracking-tight text-ink">
                    Set a monthly budget
                  </AppText>
                  <AppText className="mt-0.5 text-sm text-muted">
                    Get a nudge before the money runs out, not after.
                  </AppText>
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
                  <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>Household</AppText>
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
                      <AppText className="text-sm font-semibold text-ink">
                        {entry.member.isSelf ? "You" : entry.member.name}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {entry.count} {entry.count === 1 ? "entry" : "entries"}
                        {entry.earned > 0
                          ? ` · ${formatMoney(entry.earned, currency, { compact: true })} in`
                          : ""}
                      </AppText>
                    </View>
                    <View className="items-end">
                      <Money amount={entry.spent} currency={currency} />
                      <AppText className="text-xs text-faint">
                        {Math.round(entry.share * 100)}%
                      </AppText>
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
                  <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>Insights</AppText>
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
                    <AppText className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                      Top
                    </AppText>
                    <AppText
                      className="max-w-[76px] text-center text-xs font-bold text-ink"
                      numberOfLines={2}
                    >
                      {overview?.categories[0]?.label}
                    </AppText>
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
                  <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
                    Manage
                  </AppText>
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
                  className="min-w-[148px] rounded-[22px] p-4"
                  style={{ backgroundColor: colors.surface }}
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${account.color}1a` }}
                  >
                    <WalletIcon size={16} color={account.color} weight="duotone" />
                  </View>
                  <AppText
                    className="mt-3 text-[13px] font-medium"
                    style={{ color: colors.muted }}
                    numberOfLines={1}
                  >
                    {account.name}
                  </AppText>
                  <Money
                    amount={account.balance}
                    currency={currency}
                    size="lg"
                    className={account.balance < 0 ? "text-negative" : undefined}
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
                  <AppText className="text-[13px] font-semibold" style={{ color: colors.brand }}>
                    See all
                  </AppText>
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
  ink,
  muted,
  inverted,
}: {
  label: string;
  amount: number;
  currency: string;
  icon: React.ReactNode;
  ink: string;
  muted: string;
  inverted: boolean;
}) {
  return (
    <View
      className="flex-1 rounded-2xl px-3.5 py-3"
      style={{ backgroundColor: inverted ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)" }}
    >
      <View className="flex-row items-center gap-1.5">
        {icon}
        <AppText
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: muted }}
        >
          {label}
        </AppText>
      </View>
      <AppText
        className="mt-1 text-lg font-bold tracking-tight tabular-nums"
        style={{ color: ink }}
      >
        {formatMoney(amount, currency)}
      </AppText>
    </View>
  );
}

function ChangeChip({
  changeRatio,
  previous,
  currency,
  ink,
  muted,
  inverted,
}: {
  changeRatio: number | null;
  previous: number;
  currency: string;
  ink: string;
  muted: string;
  inverted: boolean;
}) {
  if (changeRatio === null) {
    return (
      <AppText className="mt-1 text-sm" style={{ color: muted }}>
        {previous === 0 ? "First month on the books" : ""}
      </AppText>
    );
  }

  const up = changeRatio > 0;

  return (
    <View className="mt-1.5 flex-row items-center gap-1.5">
      {up ? (
        <ArrowUpRightIcon
          size={13}
          color={inverted ? "#ff8585" : "#d64545"}
          weight="bold"
        />
      ) : (
        <ArrowDownRightIcon
          size={13}
          color={inverted ? "#6ec99a" : "#3d8f64"}
          weight="bold"
        />
      )}
      <AppText className="text-sm" style={{ color: muted }}>
        <AppText
          className="font-bold"
          style={{ color: up ? (inverted ? "#fecaca" : "#d64545") : ink }}
        >
          {formatPercent(Math.abs(changeRatio))}
        </AppText>{" "}
        {up ? "more" : "less"} than last month
      </AppText>
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
          <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
            Pace
          </AppText>
          <AppText className="mt-1.5 text-base text-ink">
            <AppText className="font-bold text-ink">
              {formatMoney(perDay, currency, { compact: true })}
            </AppText>{" "}
            a day
          </AppText>
        </View>

        <View className="items-end">
          <AppText className="text-xs font-bold uppercase tracking-widest text-faint">
            On track for
          </AppText>
          <AppText className="mt-1.5 text-base font-bold tracking-tight text-ink">
            {formatMoney(projected, currency, { compact: true })}
          </AppText>
        </View>
      </View>

      <View className="mt-4">
        <SpendLine days={days} target={budgetLimit ?? undefined} height={80} />
      </View>

      <AppText className="mt-2 text-xs text-faint">
        Day {dayOfMonth} of {totalDays}
        {daysRemaining > 0 ? ` · ${daysRemaining} days left` : " · month complete"}
        {budgetLimit ? ` · amber line is your ${formatMoney(budgetLimit, currency, { compact: true })} budget` : ""}
      </AppText>
    </Card>
  );
}
