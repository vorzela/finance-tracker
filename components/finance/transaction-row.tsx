/**
 * components/finance/transaction-row.tsx
 *
 * Activity list row — quiet meta, clear amount hierarchy.
 */

import { AppText } from "@/components/ui/app-text";

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
import { Pressable, View } from "react-native";
import type { TransactionView } from "@/types/finance";

export interface TransactionRowProps {
  transaction: TransactionView;
  currency: string;
  onPress?: () => void;
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
        "will-change-pressable flex-row items-center gap-3.5 px-4 py-3.5",
        !last && "border-b border-hairline",
        onPress && "active:bg-subtle",
      )}
    >
      {isTransfer ? (
        <View className="h-11 w-11 items-center justify-center rounded-[13px] bg-subtle">
          <ArrowsLeftRightIcon size={18} color={colors.muted} weight="bold" />
        </View>
      ) : (
        <CategoryBadge categoryId={transaction.category_id} />
      )}

      <View className="flex-1">
        <AppText
          className="text-[16px] font-medium tracking-tight text-ink"
          numberOfLines={1}
        >
          {title}
        </AppText>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          {showMember ? (
            <Avatar
              name={transaction.memberName}
              color={transaction.memberColor}
              size="xs"
            />
          ) : null}
          <AppText className="flex-1 text-[13px] text-muted" numberOfLines={1}>
            {details.join(" · ")}
          </AppText>
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
