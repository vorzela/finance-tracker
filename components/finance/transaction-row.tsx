/**
 * components/finance/transaction-row.tsx
 *
 * One line in the activity list. Shows the date *and* time so a shared ledger
 * stays accountable. Fees are spending: they are folded into the amount shown.
 */

import { CategoryBadge } from "@/components/finance/category-icon";
import { Money } from "@/components/finance/money";
import { Avatar } from "@/components/ui/avatar";
import { getCategory } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/currency";
import { timeLabel } from "@/lib/date";
import { useThemeColors } from "@/lib/theme";
import { ArrowsLeftRightIcon } from "phosphor-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { TransactionView } from "@/types/finance";

export interface TransactionRowProps {
  transaction: TransactionView;
  currency: string;
  onPress?: () => void;
  /** Shows the member avatar — only meaningful on a shared ledger. */
  showMember?: boolean;
  last?: boolean;
}

export function TransactionRow({
  transaction,
  currency,
  onPress,
  showMember = false,
  last = false,
}: TransactionRowProps) {
  const colors = useThemeColors();
  const category = getCategory(transaction.category_id);
  const isTransfer = transaction.kind === "transfer";
  const fee = transaction.fee_amount;

  const title = transaction.note?.trim()
    ? transaction.note.trim()
    : isTransfer
      ? `${transaction.accountName ?? "Account"} → ${transaction.toAccountName ?? "Account"}`
      : category.label;

  const details = [
    transaction.note?.trim() && !isTransfer ? category.label : null,
    showMember ? transaction.memberLabel : null,
    transaction.accountName && !isTransfer ? transaction.accountName : null,
    fee > 0 ? `fee ${formatMoney(fee, currency)}` : null,
    timeLabel(transaction.occurred_at),
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 px-5 py-3.5",
        !last && "border-b border-hairline",
        onPress && "active:bg-subtle",
      )}
    >
      {isTransfer ? (
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-subtle">
          <ArrowsLeftRightIcon size={18} color={colors.muted} weight="bold" />
        </View>
      ) : (
        <CategoryBadge categoryId={transaction.category_id} />
      )}

      <View className="flex-1">
        <Text className="text-base font-semibold tracking-tight text-ink" numberOfLines={1}>
          {title}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {showMember ? (
            <Avatar
              name={transaction.memberName}
              color={transaction.memberColor}
              size="xs"
            />
          ) : null}
          <Text className="flex-1 text-sm text-muted" numberOfLines={1}>
            {details.join(" · ")}
          </Text>
        </View>
      </View>

      <Money
        amount={isTransfer ? transaction.amount : transaction.totalAmount}
        currency={currency}
        kind={transaction.kind}
        muted={isTransfer}
      />
    </Pressable>
  );
}
