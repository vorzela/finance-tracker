/**
 * app/(app)/accounts.tsx
 *
 * Where money sits, for the active ledger. Balances are derived server-side
 * from the opening balance plus every transaction, so they can never disagree
 * with the ledger.
 */

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
import { FormSheet } from "@/components/ui/form-sheet";
import { ACCOUNT_GLYPHS } from "@/components/finance/category-icon";
import { cn } from "@/lib/cn";
import { currencySymbol, formatMoney, parseAmount, toAmountInput } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import { useAccounts, useArchiveAccount, useCurrency, useSaveAccount } from "@/lib/queries";
import { useScopeLabel } from "@/lib/scope";
import { PlusIcon, TrashIcon, WalletIcon } from "phosphor-react-native";
import React, { useState } from "react";
import { AppText } from "@/components/ui/app-text";
import { Alert, Pressable, View } from "react-native";
import type { AccountType } from "@/types/database";
import type { Account } from "@/types/finance";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile", label: "Mobile money" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
];

const COLORS = [
  "#2a5298",
  "#1f9155",
  "#f59e0b",
  "#8b5cf6",
  "#0ea5e9",
  "#e02020",
  "#14b8a6",
  "#4b5563",
];

export default function Accounts() {
  const currency = useCurrency();
  const ledger = useScopeLabel();
  const { accounts, isLoading, error, refetch } = useAccounts();
  const saveAccount = useSaveAccount();
  const archive = useArchiveAccount();

  const [editing, setEditing] = useState<Account | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [openingText, setOpeningText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [formError, setFormError] = useState<string | null>(null);

  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  const openNew = () => {
    setEditing(null);
    setName("");
    setType("cash");
    setOpeningText("");
    setColor(COLORS[accounts.length % COLORS.length]);
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setName(account.name);
    setType(account.type);
    setOpeningText(
      account.opening_balance === 0 ? "" : toAmountInput(account.opening_balance, currency),
    );
    setColor(account.color);
    setFormError(null);
    setSheetOpen(true);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      setFormError("Give the account a name.");
      return;
    }

    if (!editing) {
      const parsedOpening = openingText ? parseAmount(openingText, currency) : 0;
      if (parsedOpening === null) {
        setFormError("Opening balance must be a number.");
        return;
      }
      if (parsedOpening < 0) {
        setFormError("Opening balance must be 0 or more. Running balance can still go negative.");
        return;
      }
    }

    try {
      await saveAccount.mutateAsync({
        id: editing?.id,
        draft: {
          name,
          type,
          // Ignored by updateAccount once an account exists — see its
          // comment — but createAccount still needs a real value.
          openingBalance: editing ? editing.opening_balance : (parseAmount(openingText, currency) ?? 0),
          color,
        },
      });
      setSheetOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "Couldn't save the account"));
    }
  };

  const confirmArchive = (account: Account) => {
    Alert.alert(
      `Remove ${account.name}?`,
      "Past transactions keep their history — the account just stops showing up.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await archive.mutateAsync(account.id);
              setSheetOpen(false);
            } catch (cause) {
              Alert.alert("Couldn't remove", getErrorMessage(cause));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Header
        title="Accounts"
        subtitle={ledger}
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

      {isLoading ? (
        <LoadingState />
      ) : (
        <ScreenScroll onRefresh={() => void refetch()}>
          {error ? (
            <ErrorNote message={(error as Error).message} onRetry={() => void refetch()} />
          ) : null}

          {accounts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<WalletIcon size={28} color="#1e3a5f" weight="duotone" />}
                title="No accounts yet"
                message="Add Cash, M-Pesa, Bank and Card with an opening balance (0 or more). Spending counts from there — balances can go negative."
                action={
                  <Button onPress={openNew} icon={<PlusIcon size={20} color="#fff" weight="bold" />}>
                    Add an account
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <Card>
                <AppText className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Total across {accounts.length}{" "}
                  {accounts.length === 1 ? "account" : "accounts"}
                </AppText>
                <Money
                  amount={total}
                  currency={currency}
                  size="xl"
                  className={cn("mt-1", total < 0 && "text-red-500")}
                />
              </Card>

              <Section title="Accounts">
                <View className="gap-3">
                  {accounts.map((account) => {
                    const Glyph = ACCOUNT_GLYPHS[account.type] ?? WalletIcon;
                    return (
                      <Pressable key={account.id} onPress={() => openEdit(account)}>
                        <Card className="flex-row items-center gap-4">
                          <IconTile color={account.color} size={44}>
                            <Glyph size={22} color={account.color} weight="duotone" />
                          </IconTile>
                          <View className="flex-1">
                            <AppText
                              className="text-base font-bold tracking-tight text-gray-900"
                              numberOfLines={1}
                            >
                              {account.name}
                            </AppText>
                            <AppText className="mt-0.5 text-sm capitalize text-gray-500">
                              {account.type}
                              {account.opening_balance !== 0
                                ? ` · opened at ${formatMoney(account.opening_balance, currency, { compact: true })}`
                                : ""}
                            </AppText>
                          </View>
                          <Money
                            amount={account.balance}
                            currency={currency}
                            size="lg"
                            className={account.balance < 0 ? "text-red-500" : undefined}
                          />
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            </>
          )}
        </ScreenScroll>
      )}

      <FormSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit account" : "New account"}
        footer={
          <View className="gap-2">
            <Button size="lg" loading={saveAccount.isPending} onPress={submit}>
              {editing ? "Save changes" : "Add account"}
            </Button>
            {editing ? (
              <Button
                variant="danger"
                outline
                icon={<TrashIcon size={18} color="#e02020" />}
                onPress={() => confirmArchive(editing)}
              >
                Remove account
              </Button>
            ) : null}
          </View>
        }
      >
        <View className="gap-4 px-2 pb-2">
          <Input
            label="Name"
            placeholder="M-Pesa, Ziidi, Equity, Wallet…"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <View className="gap-2">
            <AppText className="px-1 text-xs font-bold uppercase tracking-wider text-gray-500">
              Type
            </AppText>
            <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} size="sm" />
            {type === "mobile" ? (
              <AppText className="px-1 text-xs text-gray-400">
                Covers any mobile wallet — M-Pesa, Ziidi, Airtel Money, Fuliza, whatever you use.
                Put the specific one in the name above.
              </AppText>
            ) : null}
          </View>

          <Input
            label="Opening balance"
            placeholder="0"
            value={openingText}
            onChangeText={setOpeningText}
            keyboardType="decimal-pad"
            editable={!editing}
            style={editing ? { opacity: 0.5 } : undefined}
            leadingNode={
              <AppText className="text-base font-bold text-gray-400">
                {currencySymbol(currency)}
              </AppText>
            }
            hint={
              editing
                ? "Set once, when the account was added — can't be changed after. Add a transaction if the real balance needs correcting."
                : "Minimum 0. Live balance = opening + transactions (can go negative)."
            }
          />

          <View className="gap-2">
            <AppText className="px-1 text-xs font-bold uppercase tracking-wider text-gray-500">
              Colour
            </AppText>
            <View className="flex-row flex-wrap gap-2.5">
              {COLORS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setColor(option)}
                  className={cn(
                    "h-10 w-10 items-center justify-center rounded-full",
                    color === option && "border-2 border-gray-900",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </View>
          </View>

          {formError ? <ErrorNote message={formError} /> : null}
        </View>
      </FormSheet>
    </Screen>
  );
}
