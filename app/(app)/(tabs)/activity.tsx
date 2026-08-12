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
import { EmptyState, ErrorNote, Header, LoadingState, Screen } from "@/components/ui/screen";
import { TAB_BAR_HEIGHT } from "@/components/ui/tab-bar";
import { getCategory } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/currency";
import { dayLabel } from "@/lib/date";
import { groupByDay } from "@/lib/analytics";
import { useMonth } from "@/lib/month";
import {
  useCurrency,
  useMembers,
  useTransactionViews,
  useTransactions,
} from "@/lib/queries";
import { useScope } from "@/lib/scope";
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
  Text,
  TextInput,
  View,
} from "react-native";
import type { TransactionKind } from "@/types/database";
import type { TransactionView } from "@/types/finance";

type KindFilter = "all" | TransactionKind;

export default function Activity() {
  const { monthKey, setMonthKey } = useMonth();
  const { scope } = useScope();
  const currency = useCurrency();
  const router = useRouter();

  const transactions = useTransactions(monthKey);
  const { data: members } = useMembers();
  const views = useTransactionViews(transactions.data ?? []);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [memberId, setMemberId] = useState<string | null>(null);

  const isShared = scope.kind === "group";

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

      <View className="gap-3 px-4 pb-3">
        <MonthSwitcher
          monthKey={monthKey}
          onChange={setMonthKey}
          className="justify-center"
        />

        {/* Search */}
        <View className="flex-row items-center gap-2.5 rounded-2xl border border-gray-200/70 bg-white px-4">
          <MagnifyingGlassIcon size={18} color="#9ca3af" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes, categories, amounts"
            placeholderTextColor="#9ca3af"
            className="h-12 flex-1 text-base text-gray-900"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <XIcon size={16} color="#6b7280" weight="bold" />
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

      {transactions.isLoading ? (
        <LoadingState label="Loading this month" />
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
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_HEIGHT + 32,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={transactions.isRefetching}
              onRefresh={() => void transactions.refetch()}
              tintColor="#1e3a5f"
            />
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-baseline justify-between px-1 pt-2">
              <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {section.title}
              </Text>
              {section.net !== 0 ? (
                <Money
                  amount={section.net}
                  currency={currency}
                  size="sm"
                  showSign
                  className={section.net > 0 ? "text-green-500" : "text-gray-500"}
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
                icon={<ReceiptIcon size={28} color="#1e3a5f" weight="duotone" />}
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
                      icon={<PlusIcon size={20} color="#fff" weight="bold" />}
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
  return (
    <View
      className={cn(
        "border-x border-gray-200/70 bg-white",
        first && "rounded-t-3xl border-t",
        last && "rounded-b-3xl border-b",
      )}
    >
      <TransactionRow
        transaction={transaction}
        currency={currency}
        showMember={showMember}
        last={last}
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
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full border px-3.5",
        active
          ? "border-navy-600 bg-navy-600"
          : "border-gray-200 bg-white active:bg-gray-50",
      )}
    >
      {leading}
      <Text
        className={cn(
          "text-sm font-semibold tracking-tight",
          active ? "text-white" : "text-gray-600",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
