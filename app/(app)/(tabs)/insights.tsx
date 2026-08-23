/**
 * app/(app)/(tabs)/insights.tsx
 *
 * The longer view: six months of trend, the full category ranking, how the two
 * of you compare, and the handful of purchases that moved the needle.
 * Also exports a PDF you can share with an AI for save/cut advice.
 */

import { CategoryBadge } from "@/components/finance/category-icon";
import { MonthBars } from "@/components/finance/charts";
import { LedgerSwitcher } from "@/components/finance/ledger-switcher";
import { Money } from "@/components/finance/money";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import {
  EmptyState,
  ErrorNote,
  Header,
  Screen,
  ScreenScroll,
} from "@/components/ui/screen";
import { InsightsSkeleton } from "@/components/ui/shimmer";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { fillMonthHistory } from "@/lib/analytics";
import { formatMoney } from "@/lib/currency";
import { monthProgress, shortDayLabel, shortMonthLabel, shortWhenLabel } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import { useMonth } from "@/lib/month";
import {
  useCurrency,
  useMonthOverview,
  useProfile,
  useTransactionViews,
} from "@/lib/queries";
import { shareMonthReportPdf } from "@/lib/report";
import { useScope } from "@/lib/scope";
import { useRouter } from "expo-router";
import { ChartPieSliceIcon, FilePdfIcon } from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Pressable, View } from "react-native";

export default function Insights() {
  const { monthKey, setMonthKey } = useMonth();
  const { scope, activeGroup } = useScope();
  const currency = useCurrency();
  const { data: profile } = useProfile();
  const router = useRouter();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { overview, rows, history, isLoading, isRefetching, refetch } = useMonthOverview(monthKey);
  const views = useTransactionViews(rows);

  const isShared = scope.kind === "group";

  const months = useMemo(
    () => fillMonthHistory(history, monthKey, 6),
    [history, monthKey],
  );

  const biggest = useMemo(
    () =>
      views
        .filter((view) => view.kind === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [views],
  );

  const busiestDay = useMemo(() => {
    const days = overview?.days ?? [];
    return days.reduce<{ dayKey: string; spent: number } | null>(
      (best, day) => (day.spent > (best?.spent ?? 0) ? day : best),
      null,
    );
  }, [overview?.days]);

  const exportPdf = async () => {
    if (!overview) return;
    setExportError(null);
    setExporting(true);
    try {
      await shareMonthReportPdf({
        monthKey,
        currency,
        overview,
        rows,
        scopeLabel: isShared ? (activeGroup?.name ?? "Household") : "Personal",
        ownerName: isShared
          ? [profile?.display_name, activeGroup?.name].filter(Boolean).join(" · ") ||
            "Household"
          : (profile?.display_name ?? "Me"),
      });
    } catch (cause) {
      setExportError(getErrorMessage(cause, "Couldn't create the PDF"));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading && !overview) {
    return (
      <Screen>
        <Header title="Insights" subtitle={shortMonthLabel(monthKey)} right={<LedgerSwitcher />} />
        <ScreenScroll bottomInset={TAB_BAR_HEIGHT + 24}>
          <InsightsSkeleton />
        </ScreenScroll>
      </Screen>
    );
  }

  const { dayOfMonth } = monthProgress(monthKey);
  const averagePerDay =
    dayOfMonth > 0 ? Math.round((overview?.totals.spent ?? 0) / dayOfMonth) : 0;
  const monthAverage =
    months.length > 0
      ? Math.round(months.reduce((sum, point) => sum + point.spent, 0) / months.length)
      : 0;

  return (
    <Screen>
      <Header title="Insights" subtitle={shortMonthLabel(monthKey)} right={<LedgerSwitcher />} />

      <ScreenScroll
        onRefresh={refetch}
        refreshing={isRefetching}
        bottomInset={TAB_BAR_HEIGHT + 24}
      >
        <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} className="justify-center" />

        {exportError ? <ErrorNote message={exportError} /> : null}

        <Card className="gap-3">
          <AppText className="text-sm leading-5 text-muted">
            Print or share a PDF of this month — handy to paste into ChatGPT / Claude for
            advice on where to save and what to cut.
          </AppText>
          <Button
            variant="secondary"
            loading={exporting}
            disabled={!overview}
            onPress={() => void exportPdf()}
            icon={<FilePdfIcon size={18} color="#1e3a5f" weight="bold" />}
          >
            Share PDF report
          </Button>
        </Card>

        <Section title="Last 6 months">
          <Card>
            <MonthBars points={months} currency={currency} activeMonthKey={monthKey} />
            <View className="mt-4 flex-row gap-3 border-t border-hairline pt-4">
              <Stat label="Monthly average" value={formatMoney(monthAverage, currency)} />
              <Stat label="Per day this month" value={formatMoney(averagePerDay, currency)} />
            </View>
          </Card>
        </Section>

        <Section title="Categories">
          {(overview?.categories.length ?? 0) === 0 ? (
            <Card>
              <EmptyState
                icon={<ChartPieSliceIcon size={28} color="#1e3a5f" weight="duotone" />}
                title="Nothing to break down"
                message="Log a few expenses and the split shows up here."
              />
            </Card>
          ) : (
            <Card className="gap-4">
              {(overview?.categories ?? []).map((category) => (
                <View key={category.categoryId} className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <CategoryBadge categoryId={category.categoryId} size={34} />
                    <View className="flex-1">
                      <AppText className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {category.label}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {category.count} {category.count === 1 ? "entry" : "entries"} ·{" "}
                        {Math.round(category.share * 100)}%
                      </AppText>
                    </View>
                    <Money amount={category.total} currency={currency} />
                  </View>
                  <ProgressBar
                    ratio={category.share}
                    color={category.color}
                    height={6}
                  />
                </View>
              ))}
            </Card>
          )}
        </Section>

        {isShared && (overview?.members.length ?? 0) > 1 ? (
          <Section title="Side by side">
            <Card className="gap-4">
              {(overview?.members ?? []).map((entry) => (
                <View key={entry.member.id} className="gap-2">
                  <View className="flex-row items-center gap-3">
                    <Avatar name={entry.member.name} color={entry.member.color} size="sm" />
                    <View className="flex-1">
                      <AppText className="text-sm font-semibold text-ink">
                        {entry.member.isSelf ? "You" : entry.member.name}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {entry.earned > 0
                          ? `${formatMoney(entry.earned, currency, { compact: true })} in · `
                          : ""}
                        {entry.count} {entry.count === 1 ? "entry" : "entries"}
                      </AppText>
                    </View>
                    <Money amount={entry.spent} currency={currency} />
                  </View>
                  <ProgressBar
                    ratio={entry.share}
                    color={entry.member.color}
                    height={6}
                  />
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        {busiestDay && busiestDay.spent > 0 ? (
          <Section title="Highlights">
            <Card className="flex-row gap-3">
              <Stat
                label="Busiest day"
                value={formatMoney(busiestDay.spent, currency, { compact: true })}
                hint={shortDayLabel(busiestDay.dayKey)}
              />
              <Stat
                label="Entries logged"
                value={String(overview?.totals.count ?? 0)}
                hint={shortMonthLabel(monthKey)}
              />
            </Card>
          </Section>
        ) : null}

        {biggest.length > 0 ? (
          <Section title="Biggest expenses">
            <Card flush>
              {biggest.map((view, index) => (
                <Pressable
                  key={view.id}
                  onPress={() => router.push({ pathname: "/entry", params: { id: view.id } })}
                  className={`active:bg-subtle ${
                    index === biggest.length - 1 ? "" : "border-b border-hairline"
                  }`}
                >
                  <View className="flex-row items-center gap-3 px-5 py-3.5">
                    <AppText className="w-4 text-sm font-bold text-faint">{index + 1}</AppText>
                    <CategoryBadge categoryId={view.category_id} size={34} />
                    <View className="flex-1">
                      <AppText
                        className="text-sm font-semibold text-ink"
                        numberOfLines={1}
                      >
                        {view.note?.trim() || view.memberLabel}
                      </AppText>
                      <AppText className="text-xs text-muted">
                        {shortWhenLabel(view.occurred_at)}
                        {isShared ? ` · ${view.memberLabel}` : ""}
                      </AppText>
                    </View>
                    <Money amount={view.amount} currency={currency} />
                  </View>
                </Pressable>
              ))}
            </Card>
          </Section>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View className="flex-1">
      <AppText className="text-[11px] font-bold uppercase tracking-wider text-faint">
        {label}
      </AppText>
      <AppText className="mt-1 text-lg font-bold tracking-tight tabular-nums text-ink">
        {value}
      </AppText>
      {hint ? <AppText className="text-xs text-faint">{hint}</AppText> : null}
    </View>
  );
}
