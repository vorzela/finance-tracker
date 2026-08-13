/**
 * lib/pay-method.ts
 *
 * How money moved for an entry: cash has no fee/SMS; M-Pesa / bank / card
 * can paste a confirmation and record transaction cost.
 *
 * Each method maps to an account type that must exist with an opening balance
 * of at least 0. The live balance is opening + transactions and may go negative.
 */

import type { AccountType } from "@/types/database";
import type { Account } from "@/types/finance";

export type PayMethod = "cash" | "mpesa" | "bank" | "card";

export const PAY_METHOD_OPTIONS: {
  value: PayMethod;
  label: string;
  hint: string;
  accountType: AccountType;
  defaultName: string;
  usesSms: boolean;
  usesFee: boolean;
  color: string;
}[] = [
  {
    value: "cash",
    label: "Cash",
    hint: "Amount only — no transaction cost",
    accountType: "cash",
    defaultName: "Cash",
    usesSms: false,
    usesFee: false,
    color: "#4b5563",
  },
  {
    value: "mpesa",
    label: "M-Pesa",
    hint: "Paste SMS for amount, fee, code, time",
    accountType: "mobile",
    defaultName: "M-Pesa",
    usesSms: true,
    usesFee: true,
    color: "#22a06b",
  },
  {
    value: "bank",
    label: "Bank",
    hint: "Paste alert SMS or type amount + fee",
    accountType: "bank",
    defaultName: "Bank",
    usesSms: true,
    usesFee: true,
    color: "#2a5298",
  },
  {
    value: "card",
    label: "Card",
    hint: "Paste bank/card alert or type amount + fee",
    accountType: "card",
    defaultName: "Card",
    usesSms: true,
    usesFee: true,
    color: "#8b5cf6",
  },
];

export function getPayMethod(id: PayMethod) {
  return PAY_METHOD_OPTIONS.find((option) => option.value === id) ?? PAY_METHOD_OPTIONS[0];
}

export function payMethodFromAccountType(type: AccountType | null | undefined): PayMethod {
  if (type === "mobile") return "mpesa";
  if (type === "bank") return "bank";
  if (type === "card") return "card";
  if (type === "cash") return "cash";
  return "mpesa";
}

/** First active account for this pay method, if any. */
export function accountForPayMethod(
  accounts: Account[],
  method: PayMethod,
): Account | undefined {
  const type = getPayMethod(method).accountType;
  return accounts.find((account) => account.type === type && !account.archived);
}

/**
 * Balance after applying this movement.
 * Expenses/fees leave the account; income arrives.
 */
export function projectedBalance(
  current: number,
  kind: "expense" | "income" | "transfer",
  amount: number,
  feeAmount: number,
): number {
  if (kind === "income") return current + amount - feeAmount;
  return current - amount - feeAmount;
}
