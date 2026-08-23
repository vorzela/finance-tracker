/**
 * app/(app)/(tabs)/activity.tsx
 *
 * The month's ledger, grouped by day. Search and the filter row narrow the
 * list in memory — the month is already loaded, so there is no reason to make
 * the database do it.
 */

import { LedgerSwitcher } from "@/components/finance/ledger-switcher";
import { Money } from "@/components/finance/money";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { TransactionRow } from "@/components/finance/transaction-row";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorNote, Header, Screen } from "@/components/ui/screen";
import { ActivitySkeleton } from "@/components/ui/shimmer";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { getCategory } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/currency";
import { dayLabel } from "@/lib/date";
import { groupByDay } from "@/lib/analytics";
import { useMonth } from "@/lib/month";
import { AppText } from "@/components/ui/app-text";
import {
  useCurrency,
  useMembers,
  useTransactionViews,
  useTransactions,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
import { useThemeColors } from "@/lib/theme";
import { activeFontFamily } from "@/lib/font-runtime";
import { useRouter } from "expo-router";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ReceiptIcon,
  XIcon,
} from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TransactionKind } from "@/types/database";
import type { TransactionView } from "@/types/finance";

type KindFilter = "all" | TransactionKind;

export default function Activity() {
  const { monthKey, setMonthKey } = useMonth();
  const { scope } = useScope();
  const currency = useCurrency();
  const router = useRouter();
  const colors = useThemeColors();

  const transactions = useTransactions(monthKey);
  const { data: members } = useMembers();
  const views = useTransactionViews(transactions.data ?? []);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [memberId, setMemberId] = useState<string | null>(null);

  const isShared = scope.kind === "group";
  const insets = useSafeAreaInsets();
  const listPadBottom = TAB_BAR_HEIGHT + insets.bottom + 28;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return views.filter((view) => {
      if (kind !== "all" && view.kind !== kind) return false;
      if (memberId && view.user_id !== memberId) return false;
      if (!needle) return true;

      const haystack = [
        view.note ?? "",
        getCategory(view.category_id).label,
        view.accountName ?? "",
        view.memberLabel,
        String(view.amount / 100),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [views, query, kind, memberId]);

  const sections = useMemo(
    () =>
      groupByDay(filtered).map((section) => ({
        ...section,
        title: dayLabel(section.dayKey),
        data: section.rows,
      })),
    [filtered],
  );

  const shownTotal = useMemo(
    () =>
      filtered.reduce(
        (sum, view) => (view.kind === "expense" ? sum + view.amount : sum),
        0,
      ),
    [filtered],
  );

  const isFiltered = kind !== "all" || memberId !== null || query.trim().length > 0;

  return (
    <Screen>
      <Header
        title="Activity"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "entry" : "entries"} · ${formatMoney(shownTotal, currency)} out`}
        right={<LedgerSwitcher />}
      />

      <View className="gap-3 px-5 pb-3">
        <MonthSwitcher
          monthKey={monthKey}
          onChange={setMonthKey}
          className="justify-center"
        />

        {/* Search */}
        <View
          className="flex-row items-center gap-2.5 rounded-2xl px-4"
          style={{ backgroundColor: colors.subtle }}
        >
          <MagnifyingGlassIcon size={18} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes, categories, amounts"
            placeholderTextColor={colors.faint}
            className="h-12 flex-1 text-[16px]"
            style={{ color: colors.ink, fontFamily: activeFontFamily({ fontWeight: "400" }) }}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <XIcon size={16} color={colors.muted} weight="bold" />
            </Pressable>
          ) : null}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          <FilterChip label="All" active={kind === "all"} onPress={() => setKind("all")} />
          <FilterChip
            label="Spending"
            active={kind === "expense"}
            onPress={() => setKind("expense")}
          />
          <FilterChip
            label="Income"
            active={kind === "income"}
            onPress={() => setKind("income")}
          />
          <FilterChip
            label="Transfers"
            active={kind === "transfer"}
            onPress={() => setKind("transfer")}
          />

          {isShared && (members?.length ?? 0) > 1
            ? members?.map((member) => (
                <FilterChip
                  key={member.id}
                  label={member.isSelf ? "You" : member.name}
                  active={memberId === member.id}
                  onPress={() =>
                    setMemberId((current) => (current === member.id ? null : member.id))
                  }
                  leading={
                    <Avatar name={member.name} color={member.color} size="xs" />
                  }
                />
              ))
            : null}
        </ScrollView>
      </View>

      {transactions.isLoading && !transactions.data ? (
        <View className="px-5">
          <ActivitySkeleton />
        </View>
      ) : transactions.error ? (
        <View className="px-4">
          <ErrorNote
            message={(transactions.error as Error).message}
            onRetry={() => void transactions.refetch()}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: listPadBottom,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={transactions.isRefetching}
              onRefresh={() => void transactions.refetch()}
              tintColor={colors.brand}
            />
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-baseline justify-between px-1 pt-2">
              <AppText
                className="text-[12px] font-semibold tracking-tight"
                style={{ color: colors.muted }}
              >
                {section.title}
              </AppText>
              {section.net !== 0 ? (
                <Money
                  amount={section.net}
                  currency={currency}
                  size="sm"
                  showSign
                />
              ) : null}
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <DayCard
              transaction={item}
              currency={currency}
              showMember={isShared}
              first={index === 0}
              last={index === section.data.length - 1}
              onPress={() => router.push({ pathname: "/entry", params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <Card className="mt-4">
              <EmptyState
                icon={<ReceiptIcon size={28} color={colors.brand} weight="duotone" />}
                title={isFiltered ? "Nothing matches" : "Nothing this month"}
                message={
                  isFiltered
                    ? "Try a different filter or clear the search."
                    : "Once you log something it will appear here, newest first."
                }
                action={
                  isFiltered ? (
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setQuery("");
                        setKind("all");
                        setMemberId(null);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      onPress={() => router.push("/entry")}
                      icon={<PlusIcon size={20} color={colors.onBrand} weight="bold" />}
                    >
                      Add a transaction
                    </Button>
                  )
                }
              />
            </Card>
          }
        />
      )}
    </Screen>
  );
}

/**
 * Rows are wrapped individually so each day reads as one card: the first and
 * last row round off, and the hairline is dropped on the last.
 */
function DayCard({
  transaction,
  currency,
  showMember,
  first,
  last,
  onPress,
}: {
  transaction: TransactionView;
  currency: string;
  showMember: boolean;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <View
      className={cn(first && "rounded-t-[22px]", last && "rounded-b-[22px]")}
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: colors.hairline,
      }}
    >
      <TransactionRow
        transaction={transaction}
        currency={currency}
        showMember={showMember}
        last
        onPress={onPress}
      />
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  leading,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      className="will-change-pressable h-9 flex-row items-center gap-1.5 rounded-full px-3.5"
      style={{
        backgroundColor: active ? colors.brand : colors.subtle,
      }}
    >
      {leading}
      <AppText
        className="text-[13px] font-semibold tracking-tight"
        style={{ color: active ? colors.onBrand : colors.ink }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
